# État du projet

**Dernière mise à jour :** 2026-09-03 · branche `main`
· dernière migration `drizzle/0073_tva_par_ligne.sql` (ce lot ne touche que
l’affichage)

*(Deux en-têtes de mise à jour cohabitaient ici depuis une fusion du 29 août,
avec deux dates et deux migrations différentes — dont une périmée. Réunis : une
ligne fausse coûte plus cher qu'une ligne absente, et celle-ci l'était à
moitié.)*


*(Le numéro du dernier commit ne figure plus ici : il était faux dès le commit
suivant, et une ligne fausse coûte plus cher qu'une ligne absente. `git log
--oneline -20` le dit sans risque de se tromper.)*

Ce fichier dit **où en est le produit**, pas ce qu'on aimerait qu'il soit. Une
ligne « fait » qui ne l'est pas coûte plus cher qu'une ligne absente.

---

## FAIT : les boutons verts portent le vert de sa note vocale, à plat (3 septembre 2026)

*Son verdict, après cinq déclinaisons sur `appli/boutons-verts.html` : « verdict
la D à plat sans brillant, donc tout ce qui est bouton cliquable tu remplaces
par la D — même pour le planning, le choix des noms des équipes (Julien,
Antoine) qui était en vert foncé », puis « ne fais pas de bricolage, remplace
correctement les lignes de code, ne fais pas de pansement », puis « ne touche
pas à la note vocale par contre ».*

Le chemin dans le code : un jeton nommé, `colors.plein`, posé par l'écran
lui-même. Il remplace le calque `--atlas-plein-fond` — un `background-image`
peint par-dessus les fonds en ligne, supprimé avec sa cause. Le pourquoi entier
est dans `ARCHITECTURE.md` §239.

| | |
|---|---|
| la couleur | `#7d9a6d` sur Origine ; les sept autres chartes gardent leur accent |
| ce qui a bougé | `design-tokens.ts`, `chartes.ts`, `globals.css`, et quarante-six aplats de boutons |
| la garde | `npx tsx scripts/test-boutons-pleins.ts` — 10 s, sans base ni navigateur |
| ce que ça coûte | la crème tient **2,97** de contraste sur ce vert (2,55 sous le doigt), là où il en faudrait 4,5. **Il l'a vu écrit en rouge sous chaque bouton avant de trancher** |

**Ce qui n'est PAS passé au vert sauge :** la note vocale (sa consigne du jour),
les capsules de « Terminés » qui portent le galet, le carré d'état du planning,
l'interrupteur de la fiche paysage, et `rust` lui-même — il teinte des textes,
des icônes et des liserés.

**S'il trouve le mot pâle en plein soleil**, ce qui reste à sa main sans toucher
à sa couleur : passer les lettres à l'encre plutôt qu'à la crème — #1c1c1a sur
#7d9a6d tient **5,46**. Ne pas le faire sans lui.

**La planche reste** (`appli/boutons-verts.html`, ses cinq états), gardée par
`appli/tests/essai-boutons-verts.mjs` : toute correction du bouton passera
d'abord par elle.

## FAIT : « Terminés » — le calme, et le galet (2 septembre 2026)

*Ses deux choix, faits sur planches : « code moi la A le calme avec la 4 le
galet », puis « code l'idée du galet aussi pour le bouton Tout et À facturer ».*

| | |
|---|---|
| les planches | `appli/termines-elegance.html` · `appli/facturer-note-vocale.html` |
| l'écran | `src/app/termines/ListeTermines.tsx` · `src/app/termines/page.tsx` |
| la matière | `.atlas-galet`, dans `src/app/globals.css` — **après** `.atlas-plein` |
| la garde | `scripts/test-galet.ts` (sans base, sans navigateur) |
| le pourquoi | `ARCHITECTURE.md` §235 et §236 |

**Le calme :** les montants se posent sur la ligne de base du nom au lieu d'être
centrés sur la rangée (une colonne, enfin) ; le nom du mois passe de 21 à 26 px ;
les onglets à 44 px ; la carte de TVA respire de 20 px. La ligne d'état quitte
l'or et le gris — 2,8 et 3,4 de contraste — pour l'encre douce, à 8,0.

**Le galet :** la capsule « À facturer » et l'onglet actif prennent le vert, l'or
et l'ombre de la note vocale, avec un dégradé qui suit le grand axe et un seul
filet. La matière est **fixe sur les huit chartes**, comme celle du micro.

**Ce qui n'est PAS codé, et c'est son choix :** les propositions B (la plaque
sous le mois) et C (la colonne d'euros dans « À facturer ») restent dessinées.

**Ce qui reste ouvert :** « 3 à facturer · 10 facturés » compte tous les mois —
sa demande du 23 août — mais s'affiche sous le nom d'un mois précis, et ne bouge
pas quand on recule. Posé sur la planche, pas tranché.

## FAIT : l'accueil respire (2 septembre 2026)

Ses trois chiffres : **44 px** au-dessus du titre (au lieu de 34), titre à
**40 px** (au lieu de 36), **21 px** entre deux chantiers (au lieu de 17).
*« Par contre ne touche à rien d'autre »* — le bouton « Créer un devis » reste
où il est, sous le titre et au-dessus de « En cours ».

**La typographie ne change pas.** Trois identités lui ont été montrées sur cet
écran ; il garde Georgia et la police du téléphone. Aucune police n'est chargée
dans Atlas, et c'est délibéré.

---

## FAIT : la fiche client en registres (2 septembre 2026)

**Son feu vert, après avoir manipulé la maquette :** *« c'est très bien, code
exactement ce que tu viens de me faire comme maquette »*. Deux allers-retours
l'ont précédée, et il a corrigé deux de mes choix : le « Client » reste **doré**
et repasse **au-dessus** du nom ; la suppression garde le style discret et sa
fenêtre de prévention.

Ce que l'écran fait maintenant :

| | |
|---|---|
| l'en-tête | « CLIENT » doré au-dessus du nom, nom à **40 px**, adresse et téléphone en bas de casse |
| la dernière prestation | l'étiquette en capitales grises, **son contenu en serif encre pleine** |
| le dossier | **trois onglets** — Devis · Factures · Fiches — et un trait d'or qui glisse |
| une pièce | une ligne pleine largeur : numéro en serif à gauche, date à droite, chevron |
| un appui | inchangé — Enregistrer · Ouvrir · Partager (sa proposition C du 21 août) |
| supprimer | une ligne en capitales, puis la feuille de prévention du 27 août, refaite en filets |

**Ce que ça retire, et il a été prévenu :** on ne voit plus les trois catégories
d'un seul coup d'œil. C'est le prix des 118 px de colonne qui coupaient les
numéros de devis.

**Aucune règle métier n'a bougé** : ni les catégories, ni leur ordre du 20 août,
ni le tri, ni les trois choix d'un appui, ni les trois temps de la suppression.

**Un défaut d'outillage corrigé au passage :** `npm run verifier:avant-livraison`
rendait ses neuf étapes en échec en une seconde sous Windows — `spawnSync` n'y
sait pas lancer `npm`. La batterie tourne maintenant sur cette machine.

Détail : `docs/fiche-client-en-registres.md`, `ARCHITECTURE.md` §232.

## FAIT : la fiche client tient dans un écran, centrée (1ᵉʳ sept. 2026)

Sa demande : une seule page, centrée, sans marge excessive. La page faisait
933 px pour 844 de fenêtre — 272 px de réserve en bas pour une barre de 48.

Désormais **0 px de débordement** sur ses tailles d'iPhone, contenu centré.
Mesuré par `scripts/capture-fiche-client-hauteur.mts`, gardé par
`test-fiche-client-e2e` (qui sait rougir).

## FAIT : plusieurs TVA sur un même devis (1ᵉʳ sept. 2026)

**Sa question :** *« si j'ai de la main d'œuvre TVA à 20 et des plantes TVA à
10, je peux avoir deux TVA différentes ? »* Le devis n'en portait qu'une.

**Le taux ne se pose PAS ligne par ligne** — il l'a tranché contre la première
proposition : *« j'appuie sur ajouter une TVA, une catégorie s'ajoute et là je
mets toutes mes lignes qui seront en TVA à 10 »*.

| | |
|---|---|
| un seul taux | l'écran et le PDF sont **exactement** ceux d'avant |
| « + Ajouter une TVA » | une catégorie s'ouvre, avec sa première ligne |
| une catégorie | porte autant de lignes qu'il veut, et son sous-total HT |
| les totaux | une ligne de TVA par catégorie |
| le « − » | retire la catégorie ; **ses lignes reviennent**, elles ne meurent pas |
| **appui long** sur une ligne | la déplace vers une autre TVA — son choix du 1ᵉʳ sept. |

Le taux vit sur la ligne (migration 0073, nul = suit le devis) et voyage jusqu'à
la facture émise. Le prix accordé au client se répartit au prorata entre les
catégories — sans quoi la TVA se calculerait sur le brut. Règle :
`src/lib/reduction-devis.ts`. Détail : `ARCHITECTURE.md` §231. Maquette :
`appli/devis-tva-multiple.html`.

## « Terminés » porte la date du chantier, et la ligne dorée a maigri (31 août 2026)

Sous le nom du client, l'écran écrit maintenant **la date du chantier puis le
montant prévu** — « 12 août · 360,00 € prévus » —, et la capsule dit **« À
FACTURER »**. « Pas encore facturé » n'existe plus : la capsule le disait déjà,
sur la même ligne. Il a choisi la proposition B de
`appli/termines-date-du-chantier.html`, puis : *« très bien, code-moi ça »*.

| | |
|---|---|
| la règle | `libelleDateChantier` et `libelleEtatLigne`, dans `src/lib/termines-par-mois.ts` |
| l'écran | `src/app/termines/ListeTermines.tsx` |
| l'année | écrite **seulement si ce n'est pas celle du jour** — l'onglet « À facturer » mêle tous les mois |
| sans date ni devis | **pas de deuxième ligne du tout** : ni tiret, ni phrase, ni « · » pendu |

**Ce que la date EST, et il faut le savoir avant d'y toucher :** `datePlanifiee`,
la date du planning — l'application n'en garde aucune autre. Un chantier clôturé
sans être passé par le planning n'a donc pas de date. **Question ouverte, à
lui :** faut-il saisir une vraie date de réalisation à la clôture ?

---

## Il n'y a plus qu'une fiche client (31 août 2026)

**Sa demande, deux captures à l'appui :** *« lorsque je fais retour j'arrive sur
la page 1re photo alors que je veux arriver sur la 2e. Je sais pas d'où sort la
1re photo ? Si elle sert à rien il faut la supprimer. »*

La fiche rouverte (`/chantiers/[id]/coordonnees`) portait tout sauf la
pellicule, l'anneau et la chaîne du devis. Elle les porte désormais, **nourris
de ce que le chantier a déjà** — photos prises, note dictée. Seul
« Enregistrer » l'en distingue encore : elle seule a quelque chose à sauver.

Raisons : `ARCHITECTURE.md` §226.

---

## FAIT : la dictée est une ligne, sans aucun aplat (31 août 2026)

**C'est l'état du produit :** pendant qu'on dicte, la fiche porte une ligne fine
— poubelle, chrono, onde, et un rond d'envoi creux cerclé de vert. Plus de
disque plein, plus de pause. L'aplat sombre passe de 7 956 px² à 64.

Sa plainte du matin (*« ça dénature l'appli »*), quatre allures essayées, sa
réponse : la ligne, avec le rond. Détail et pièges : `ARCHITECTURE.md` §228.
**Le même dessin sert l'écran d'un chantier neuf**, qui porte le même
composant.

---
## Le banc garde sa version rapide pendant qu'il bâtit la suivante (31 août 2026, soir)

**Sa huitième plainte de lenteur** — *« l'appli est lente, corrige ça »*.
Jusqu'ici son banc jetait sa version rapide dès que le code changeait et servait
le mode développement le temps de bâtir : un mode où un écran neuf compile plus
lentement que le relais de GitHub n'accepte d'attendre. Il ne pouvait ouvrir
aucun écran qu'il n'avait pas déjà ouvert, et chaque redémarrage l'y remettait.

La version bâtie reste désormais en service pendant la construction, qui se fait
dans un dossier voisin ; la bascule est un échange de noms. Mesuré en le jouant :
`/login` en **0,28 s pendant la construction**. Une construction qui échoue ne le
condamne plus au mode lent jusqu'au lendemain — il garde une application entière,
en retard de quelques commits, et **l'écran comme la fiche le disent**.

Au passage : la fiche de son espace concluait « ✅ Tout concorde » sur un banc
sans version rapide, et envoyait donc chercher le défaut dans le produit.

`ARCHITECTURE.md` §225 · `docs/appli-lente-version-davant.md`

## EN ATTENTE : le geste des boutons — une planche, pas du code (31 août 2026)

**Rien n'a bougé dans l'application**, et c'est l'état exact du produit : les
boutons d'Atlas ne vibrent pas, et leur seul geste est `active:scale-[0.985]` —
moins d'un pixel sur une capsule de 50 px, aucune couleur.

Sa demande du 31 août : *« une mini vibration, que l'utilisateur soit sûr
d'avoir appuyé »*, et le bouton qui s'enfonce en s'éclaircissant. Trois forces
lui sont proposées sur `appli/le-bouton-qui-repond.html` — Discret, la sienne,
Marqué — sur les quatre surfaces qu'il touche.
**Sa réponse est attendue ; le pourquoi est en `ARCHITECTURE.md` §222.**

---

## Un devis sans client renvoie à la fiche client (31 août 2026)

**Sa demande, deux captures à l'appui :** *« j'ai oublié de renseigner la fiche
client du chantier. Lorsque je fais retour, je dois arriver sur la page de la
fiche client ! Pas sur la page que je te mets en deuxième photo. »*

| | |
|---|---|
| devis **sans client** | la flèche mène au formulaire « Fiche client » du chantier |
| devis **avec client** | la flèche rend la fiche du chantier, comme avant |
| fiche enregistrée, venu du devis | on **retourne au devis**, qui porte enfin le client |
| fiche ouverte depuis l'accueil | inchangé : flèche vers la liste, enregistrement vers le chantier |

La provenance voyage dans l'adresse (`?de=`) et n'est acceptée que si elle vaut
**exactement** le devis de ce chantier — sans quoi la flèche « retour » pourrait
sortir d'Atlas. Règle : `src/lib/retour-du-devis.ts`. Éprouvé par
`scripts/test-retour-du-devis.ts` et `scripts/test-devis-sans-client-e2e.ts`.
Raisons : `ARCHITECTURE.md` §221.

---

## Le diamètre dicté n'est plus redemandé (30 août 2026)

*Il disait « un érable de 40 centimètres au pied » et « deux souches de 60 », et
Atlas lui redemandait les deux. Le diamètre ne se perdait nulle part dans la
chaîne : **il n'était jamais créé** — le seul écrivain de la colonne était ses
réponses aux questions dont il se plaignait. Détail et pourquoi :
`ARCHITECTURE.md` §220.*

Trois choses en découlent, toutes visibles chez lui :

| | |
|---|---|
| l'arrêt d'avant-chiffrage | ne redemande plus un diamètre qu'il a prononcé |
| le devis | affiche « Dessouchage de souches de 60 cm », le compte restant en colonne Qté |
| la colonne de chaque ligne | s'intitule « Montant HT » ; le total du bas reste « Total HT » |

**Ce qui reste à éprouver, et qui ne peut pas l'être ici :** ce que le modèle
répond vraiment. `npm run verifier:chaine-dictee` sur son espace, où les clés
sont posées.

---

## Le devis du client : verrouillé, dans un écran, et téléchargeable après coup (31 août 2026)

Ses trois captures du téléphone d'une cliente.

| | État |
|---|---|
| Le PDF du client ne se modifie plus dans Acrobat | **fait** — chiffré, autorisations posées : imprimer et copier oui, modifier et annoter non |
| La facture et la feuille de chantier aussi | **fait** — un seul endroit protège les trois |
| Le devis protégé s'ouvre sans mot de passe | **fait, et éprouvé par un lecteur tiers** (moteur PDF de Chromium) |
| Toute la réponse tient dans un écran de 664 px | **fait** — 770 px demandés, 630 désormais |
| Le devis se télécharge après l'avoir accepté | **fait** — sur l'écran de retour et sur la confirmation |
| Le fichier descend au lieu de s'ouvrir dans le lecteur | **fait** — `?telecharger`, décidé par le serveur |

**Ce qui n'est PAS promis :** la protection n'est pas un coffre-fort. Elle
empêche la retouche d'un doigt, pas un outil déterminé — le format est public.
La pièce qui fait foi reste celle qu'Atlas archive à l'envoi.

**Ce qui reste ouvert :** aucun geste n'est proposé après un refus ni après une
demande de correction — à trancher par le patron.

Raisons et pièges : `ARCHITECTURE.md` §223.


## Un prix posé débloque l'envoi, et il peut proposer demain (31 août 2026)

Ses deux captures du matin, sur l'écran d'envoi du devis.

| | État |
|---|---|
| Un prix tapé sur l'écran du DEVIS efface « à chiffrer » | **fait** — il ne l'effaçait que depuis l'écran Prix, et l'envoi restait bloqué sans aucune sortie |
| La phrase du refus, écrite une seule fois | **fait** — deux versions avaient divergé, d'où ses fautes d'accord |
| Un devis ne peut plus afficher un total que son tableau contredit | **fait** — le PDF disait « à chiffrer » sur 1 720 € que le total comptait |
| Il peut proposer aujourd'hui et demain | **fait** — l'application prévient, elle ne refuse plus |
| L'application ne SUGGÈRE toujours rien avant après-demain | **inchangé, et voulu** |
| Un jour passé | **refusé**, et ce n'est pas un arbitrage |
| Son client peut accepter une date proche | **fait** — il ne le pouvait pas, et rien ne l'aurait signalé |

**Ce qui reste ouvert :** le délai de deux jours n'est réglable nulle part. Il
est écrit dans le code, pas dans les réglages de l'entreprise. Personne ne l'a
demandé — à trancher par le patron.

Raisons et pièges : `ARCHITECTURE.md` §216.

## La connexion tient dans un écran (31 août 2026)

**Sa demande :** *« Pour la page connexion je veux qu'elle tienne sur une seule
page et supprime toutes les petites phrases en gris sous les boutons, garde que
les titres. »*

| | |
|---|---|
| avant | **1203 px** pour 664 de hauteur utile — « Ailleurs » à un écran du reste |
| après | **658 px**, tout visible d'un seul tenant sur son iPhone |
| les gloses grises | **parties** : Face ID, « vous resterez connecté », « un téléphone perdu… », la ligne sous « Me déconnecter partout » |
| ce qui reste | les titres, les trois champs, les trois gestes |

**Ce qui ne s'est pas perdu avec les phrases :** « Au moins 12 caractères »
n'est plus affiché d'avance mais se dit **quand il tape trop court**
(`etatNouveau`), sans quoi un bouton serait resté éteint sans raison lisible.

**Ce qui s'est perdu, et qui est ouvert :** la promesse de Face ID — *« votre
visage ne quitte jamais votre téléphone »* — n'est plus à l'écran. Elle survit
dans le mode d'emploi. Les faits, eux, n'ont pas bougé : aucune donnée
biométrique n'entre en base, et c'est la base que la suite interroge.

Compte-rendu qui lui est destiné : `docs/connexion-une-page.md`. Le détail :
`ARCHITECTURE.md` §217.

## L'or est le même sur les huit apparences (31 août 2026)

**Sa consigne :** *« pour l'apparence, j'aimerais que tout ce qui est en doré
sur la version originale apparaisse en doré sur les autres apparences »*.

Chaque charte portait son propre second accent — sauge sur Pierre, argile sur
Moka, prune sur Prune, un bleu et un rose pour les traits de Brume et de Prune.
Changer d'apparence repeignait donc tout ce que l'or porte : l'accueil, les
libellés d'état, les filets, le sceau, le compteur de la dictée.

Les huit chartes portent l'or d'Origine, `#B98B47`, au caractère près
(`src/lib/chartes.ts`). Mesuré : il se détache mieux sur les deux sombres (6,14
sur Nuit) que sur Origine (2,77) — rien à remonter. Une suite tient la règle
pour les huit ; les deux suites existantes vérifiaient la présence des jetons et
la lisibilité, jamais l'identité. Détail : `ARCHITECTURE.md` §218.

---

## La connexion ne peut plus bouger (31 août 2026)

**Sa demande :** *« la page connexion n'est pas fixe, elle peut bouger encore ;
il ne faut pas qu'elle puisse bouger, aucun scroll possible »*.

| | |
|---|---|
| la page | **figée** : ni défilement, ni élastique du navigateur |
| le bandeau du banc | publie sa **vraie** hauteur (49 px, 66 sur écran étroit) au lieu des 40 écrits à la main |
| ce qui en profite | les trois écrans figés — chantiers, envoi, connexion — cessent d'être 50 px trop hauts sur son banc |
| ce qui reste | bandeau affiché, il manque 51 px : ils glissent dans une colonne intérieure plutôt que de cacher un bouton |

Sans le bandeau — le produit, et son banc dès que la construction est finie —
rien ne bouge d'un pixel. Le détail : `ARCHITECTURE.md` §227.

## Le planning garde deux ans de jours passés (31 août 2026)

**Sa question :** *« est-ce que le planning garde en mémoire les chantiers
passés ? Si non il faut qu'il les garde en mémoire au moins sur une année »*,
puis *« combien si je décide de garder en mémoire 2 ans ? C'est trop lourd ou
pas ? »*

**Ce qui était vrai :** rien n'était effacé — les chantiers sont tous en base, et
« Terminés » les liste — mais le CALENDRIER repeignait chaque jour en blanc le
lendemain. Son mois de juillet était vide alors qu'il y avait travaillé.

**Ce qui est fait**, planche 100, proposition **B** :

| | |
|---|---|
| le jour passé | garde ses barres et **ses couleurs**, comme s'il était à venir |
| jusqu'où | **deux ans** (`MEMOIRE_CALENDRIER_JOURS`) ; au-delà, « Terminés » |
| ce qu'on y fait | on **lit** : pas de « + Ajouter », pas de salarié à cocher, pas de déplacement |
| ce qui ne bouge pas | le chantier passé reste rangé dans « Terminés », lui seul |

**Le poids, mesuré** (`npm run mesurer:poids-planning`) : 1 000 chantiers — deux
ans — font 594 Ko bruts, **71 Ko** une fois la page comprimée. Et la requête du
planning, qui n'avait aucune borne basse, s'arrête désormais au même jour que
l'écran : dès la troisième année, elle envoie MOINS qu'avant.

Le raisonnement complet, les fautes évitées et les deux contrôles creux
retrouvés : `ARCHITECTURE.md` §224.

## La note vocale à la messagerie, et la fiche qui tient dans un écran (30 août 2026)

**Sa demande, en huit messages :** *« Il faut modifier la note vocale pour
qu'elle soit plus simple à utiliser, à la manière de celle de WhatsApp : on
appuie dessus, possibilité de supprimer ou d'appuyer sur la flèche pour envoyer
de suite la transcription, et arriver sur la page du devis. »* Puis, après trois
planches et ses trois choix : *« Très bien, code exactement ça ! »*

Ce que l'écran fait maintenant :

| | |
|---|---|
| au repos | un **disque plein**, son micro, deux ondes de **1,5 cm** de chaque côté |
| on appuie | la **poubelle** naît à gauche, l'**avion** à droite ; le micro devient un carré d'arrêt, le disque ne bouge pas |
| la poubelle | jette la note, relâche le micro, rend l'écran à ce qu'il était |
| l'avion | envoie, transcrit, **mène au devis** — rien d'autre à toucher |
| « Je rédige à la main » | **secondaire**, large de **66 %**, et il **disparaît** pendant qu'on parle |

**La fiche client tient dans un écran, sans défiler et sans vide en bas.** Elle
débordait de 492 px : l'anneau et le bouton étaient sous le pli. Mesuré sur son
écran (390 × 664) et par son parcours : 604 px de feuille pour 601 de contenu.

**Et elle ne se balade plus de droite à gauche.** Deux causes, aucune visible à
l'œil : le champ du nom gardait sa largeur naturelle et poussait le téléphone
31 px hors de l'écran ; la pellicule de photos dépassait de deux pixels de
chaque côté.

Le compte-rendu qui lui est destiné : `docs/note-vocale-messagerie.md`. Les
raisons et les pièges : `ARCHITECTURE.md` §211.

---

## Chaque notification se range d'un « J'ai vu » (30 août 2026)

**Sa demande, capture à l'appui :** *« pour chaque notification je dois pouvoir
cliquer sur vu pour les faire disparaître ; pourquoi certaines n'ont pas cette
fonction ? »*. Trois rappels sur quatre n'avaient aucun geste.

Les quatre cartes de rappel portent désormais le même mot que les réponses de
clients. **Le geste fait taire, il n'efface pas** : le rappel revient au bout de
son délai réglé si rien n'a bougé (`rappels_vus`, migration 0071). La facture
impayée garde sa mécanique du 16 août et ne prend que le libellé — « Plus tard »
disparaît.

Détail : `docs/j-ai-vu-sur-tous-les-rappels.md`, `ARCHITECTURE.md` §210.

## QUATRE RÔLES, ET LE COMMERCIAL NE FACTURE PLUS (30 août 2026)

Le modèle des utilisateurs est **figé** avant le déploiement.

| | |
|---|---|
| **Patron** | tout Atlas — l'administrateur de son entreprise |
| **Facturation** *(neuf)* | clients, devis, factures, TVA. Planning en lecture. Aucune administration |
| **Commercial** | clients, devis, planning en écriture (suppression comprise). **Aucune facturation** |
| **Salarié** | planning en lecture seule, sa feuille sans un montant |

Plusieurs personnes portent le même rôle — c'était déjà vrai en base (clé unique
sur entreprise + personne), il n'y a **pas** de compte partagé « Facturation ».

**Le défaut fermé dormait depuis le 13 août** : les dix actions du cycle
comptable se gardaient par « tout sauf le salarié », donc un commercial
facturait pour de bon — alors que `docs/QUESTIONS.md` §10 disait *« ni les
factures, ni la TVA »*. L'écran des accès lui **promettait** même le contraire.

**Ce que ça coûte :** un commercial ne clôture plus un chantier — « Créer la
facture » crée la facture.

Détail : `docs/modele-des-roles.md`, `ARCHITECTURE.md` §212. Migration 0071.

## Le planning du salarié est en LECTURE SEULE (30 août 2026)

**Sa décision :** *« Un salarié peut uniquement CONSULTER son planning. Il ne
doit pouvoir effectuer AUCUNE modification depuis le planning. »*

Ni supprimer un chantier, ni le poser, ni le déplacer, ni le retirer du
planning, ni écrire son pense-bête, ni cocher une équipe. **Refusé au serveur**
— une requête fabriquée avec l'identifiant de l'action et celui du chantier est
refusée comme un appui sur un bouton.

**Ce qui n'a pas bougé** : sa portée de lecture, sa feuille de chantier sans
montants, les droits du patron et ceux du commercial.

Trouvé en chemin et corrigé : les actions **photos** d'un chantier n'avaient
aucune garde — un salarié pouvait en supprimer n'importe laquelle, pour de bon.

Détail : `docs/salarie-planning-lecture-seule.md`, `ARCHITECTURE.md` §208.

## Ce qui a déjà été dicté ne se redemande plus (30 août 2026)

*« Tu dis deux souches de diamètre 60. Question : quel diamètre font les
souches ? »* La lecture découpe à la virgule ; la question ne regardait que sa
propre ligne, quand la hauteur était cherchée dans toute la dictée depuis le
premier jour. Corrigé — avec une garde : à deux arbres, on redemande ligne par
ligne, un diamètre dit quelque part n'appartenant pas forcément à celui qu'on
questionne.

Les questions ne nomment plus leur objet : « Quel diamètre ? », « Quelle
hauteur ? », « Quelle longueur ? ».

Deux textes qui décrivaient ce que l'écran montrait déjà sont partis :

| Où | Ce qui reste |
|---|---|
| écran Transcription | rien — le titre et le cadre suffisent |
| refus de chiffrer | « Aucun tarif ne correspond, et la dictée ne dit ni la durée ni l'équipe. » |

---

## L'arrêt d'avant-chiffrage : moins de mots, et plus de question absurde (30 août 2026)

Deux remarques de lui, le même jour, sur le même écran.

**L'incohérence.** *« Lorsque l'on parle de souche, ça sous-entend que l'arbre a
déjà été abattu — donc s'il n'y a pas d'arbre, pourquoi il y a la question de
comment on l'abat ? »* Le dessouchage était rangé avec l'abattage pour ne pas
redemander le diamètre du même tronc ; le raccourci commandait aussi la question
de la technique. Une souche reçoit maintenant son diamètre seul, sous le mot
juste.

**Les mots.** *« Trop de phrases inutiles, il faut aller droit au but,
l'utilisateur n'aime pas lire. »* Retirées : les deux lignes sous le titre, la
ligne d'explication sous chaque question — et le champ `pourquoi` avec elles —,
et la prestation réécrite à chaque question. Titre : « Avant de chiffrer ».

| | |
|---|---|
| `src/lib/questions-chiffrage.ts` | `estDessouchage`, sujet `dessouchage.diametre`, `pourquoi` supprimé |
| `src/app/chantiers/[id]/DevisDepuisDictee.tsx` | l'écran ne porte plus que prestation, question, réponses |
| trois suites navigateur | comptent les blocs `[data-atlas="question-chiffrage"]`, plus un libellé |

Détail : `ARCHITECTURE.md` §209.

---

## Plus aucune barre de défilement grise, la page comprise (30 août 2026)

Sa plainte du jour, depuis son PC : *« sur PC les bandes déroulantes grises
apparaissent, supprime-moi ça »*. Deuxième fois — le 11 août, seuls les cadres
qui défilent avaient été couverts, pas **la page elle-même**, qui défile aussi
(le gabarit lui donne `100dvh` de hauteur *minimale*).

Sur téléphone cette barre est en surimpression et s'efface seule ; sur
ordinateur elle s'installe à droite pour de bon. Le défaut ne pouvait apparaître
que chez lui, et le contrôle qui aurait dû l'attraper écartait explicitement
`<html>` et `<body>`.

| | |
|---|---|
| `src/app/globals.css` | une règle universelle `* { scrollbar-width: none }` remplace la déclaration recopiée zone par zone |
| `scripts/test-aucune-barre-de-defilement-e2e.ts` | mesure désormais la page ; éprouvé rouge (8 écrans sur 13) avant d'être éprouvé vert |

Le défilement n'a pas changé — molette, doigt, clavier, focus. Détail :
`ARCHITECTURE.md` §206.

## Le devis client ne répète plus les mesures (30 août 2026)

*Son premier vrai devis sorti de la chaîne corrigée portait « Haie de laurier
(800 ml) (800 ml) » et « Érable (40 cm de diamètre, 12 m de haut) ». Détail et
pourquoi : `ARCHITECTURE.md` §214.*

**Fait.**

| | Où |
|---|---|
| Le libellé que le client lit est nettoyé des mesures **déjà en colonne** | `src/lib/libelle-client.ts` |
| Ce que les moteurs de prix relisent — `membres` — reste **intact** | `src/lib/lignes-vendables.ts` |
| La recollure de la quantité ne double plus ce que le modèle a déjà écrit | `brouillon-service.ts` |
| Ses quatre lignes du 30 août, plus le refus de retirer une méthode | `scripts/test-libelle-client.ts` |

**Ce qui n'a PAS changé, et c'est délibéré :** aucune donnée structurée n'est
retirée de la base, aucun devis existant n'est réinterprété, l'invite du modèle
n'est pas touchée, et le regroupement des prestations est inchangé.

---

## Le banc répare ses dépendances désaccordées (29 août 2026)

Son espace exécutait Next 16.3.3 alors que le projet épingle 16.3.2 : les
binaires natifs de Next étant versionnés à l'identique, la construction mourait
après son en-tête, sans un mot — et la réinstallation automatique, qui exigeait
un message, ne se déclenchait jamais.

Le banc compare les versions avant de bâtir et réinstalle si elles ont dérivé.
Un second filet rattrape une construction morte sans rien dire. Éprouvé contre
son état exact. `ARCHITECTURE.md` §204.

---

## Le banc ne préchauffe plus quand la mémoire manque (29 août 2026)

Son espace restait en mode lent des jours durant : le préchauffage des 32 écrans
prend 887 Mo au serveur de développement, la construction de la version rapide
en veut 2 500, et son espace n'en a que 2 900 de disponibles. Le noyau tuait la
construction, le veilleur en relançait une, et rien ne se dénouait.

Le préchauffage s'abstient désormais sous le seuil, et le dit avec sa borne :
les premiers écrans sont lents *le temps de la construction, pas au-delà*. Les
machines qui ont la place préchauffent comme avant.

Éprouvé par `scripts/test-memoire-prechauffage.ts`, vu rougir contre trois
régressions. Mesures et pistes écartées : `ARCHITECTURE.md` §203.

---

## Le réglage dit la couleur qu'il produit au planning (31 août 2026)

**Sa réponse à la planche 99 : A**, arrêtée sur maquette puis codée le jour même
(`appli/reglages-planning-complet.html`).

Sous « Chantiers menés en même temps », l'écran disait *« C'est ce qui remplit
votre planning »* : il annonçait un effet sans montrer ce qu'on verrait. Il dit
maintenant **« 2 chantiers par jour. Planning ▪ complet. »**, avec le carré du
calendrier et son mot.

Deux pièces le tiennent, et elles ferment une divergence plutôt qu'elles
n'ajoutent une couleur : `MOT_ETAT` (`src/lib/planning-jour.ts`) porte les
quatre mots de la légende — que le calendrier écrivait en clair — et
`phraseDuCompteur` rend deux morceaux, puisque ce qui se glisse entre eux n'est
pas du texte mais `fondDeLEtat("plein")`.

---

## Ses salariés se comptent à part de ses équipes (26 août 2026)

**Sa réponse à la planche 97 : A**, arrêtée sur maquette puis codée le jour même
(`appli/salaries-et-equipes.html`, migration 0067, `ARCHITECTURE.md` §192).

Deux compteurs là où il n'y en avait qu'un : **les équipes** disent combien de
chantiers tiennent dans une journée, **les salariés** disent qui part. Régler
l'un ne dérègle plus l'autre — un paysagiste à quatre salariés peut enfin ne
mener qu'un chantier à la fois.

Sur le chantier, **la façon de faire n'a pas bougé d'un geste** (sa consigne) :
la pastille sur la demi-journée, la liste qui s'ouvre, les cases cochées une à
une, « Terminé ». Ce sont les libellés qui changent — « Équipe A » a disparu, le
repli est « Salarié 3 ».

La charge du planning est plafonnée à la capacité : trois gars sur un même
chantier ne ferment pas une journée qui en accepte deux. **À effectif égal —
son cas — le planning se remplit exactement comme avant.**

Un artisan seul reste à **zéro** salarié : aucune case à cocher, rien n'a changé
pour lui.

Reste ouvert : le renommage `equipes` → `salaries` en base et dans le code, tenu
à part parce qu'il touche vingt-trois fichiers (`TODO.md`).
## Les phrases du régime de TVA, réécrites (26 août 2026)

*« Quand le client le paye / quand je met la facture. C'est pas clair, on
comprend rien. »* **Fait.** Le surtitre dit le geste — « je reverse ma TVA aux
impôts » —, chaque ligne répond à « et alors ? », et une phrase annonce ce que
le choix change sur le mois affiché, y compris quand il n'y change rien.
`ARCHITECTURE.md` §195.

---

## Le rythme de la TVA fait bouger l'écran (26 août 2026)

*Sa plainte : « quand je change entre tous les mois et tous les trois mois,
c'est pareil, rien ne se passe ».* **Corrigé** — il manquait la revalidation,
et `force-dynamic` ne la remplace pas (`ARCHITECTURE.md` §193).

**Sa seconde plainte du même soir n'était PAS un défaut** : entre les deux
régimes de TVA, rien ne change quand toutes les factures du mois ont été payées
dans le mois. Ce qui manquait est une phrase à l'écran : **codée** le soir même
(`ARCHITECTURE.md` §195).

---

## Un choix fait par erreur se défait (26 août 2026)

*Sa demande : « si par erreur j'ai sélectionné un des 3 champs je ne peux plus
le désélectionner ! Je dois pouvoir désélectionner ».*

Sur la page que reçoit son client, un second appui sur la date déjà cochée la
**défait**, et rien ne se coche à la place. Vaut aussi pour « une autre date »,
dont le calendrier se referme. Le détail — et pourquoi `onClick` plutôt
qu'`onChange` — est dans `ARCHITECTURE.md` §191.

**Le même piège dort sur le choix entre deux tarifs ambigus**
(`PropositionPrixSection.tsx`) : il ne l'a pas signalé, c'est noté dans
`TODO.md`.

---

## « Terminés » : plus de traits, et la TVA se voit cliquable (26 août 2026)

*Ses deux demandes, planche `appli/termines-sans-traits.html`, sa réponse :
« le 3 ». Le détail est dans `ARCHITECTURE.md` §198.*

**Fait.** Plus aucun trait entre les rangées. La carte « Ma TVA à déclarer »
porte un contour doré — même forme, même titre, même montant.

**Ce qui a demandé plus que le retrait.** Le trait tenait le second étage d'une
rangée à distance du nom de la suivante : retiré sec, deux rangées se liraient
comme une seule. La respiration passe de 19 à 24 px, et la première rangée garde
22 px — tout ce qui reste de la démarcation qu'il avait demandée le 23 août.

## La chaîne dictée → devis a été refaite (27 août 2026)

*Le devis du 26 août portait trois défauts : la quantité dictée n'existait plus
comme donnée, une tonte et un démontage partageaient une identité, et une ligne
qu'on ne savait pas chiffrer s'écrivait « 0 € ». Le détail est dans
`ARCHITECTURE.md` §205 ; le dossier à retransmettre est
`docs/pour-chatgpt/07-correction-complete.md`.*

**Fait.**

| | Où |
|---|---|
| **Un référentiel des natures**, à la place de six vocabulaires dispersés — dont aucun ne connaissait la tonte | `src/lib/natures-prestation.ts` |
| **Une nature inconnue garde sa propre ligne** et sort « à chiffrer » : identité et capacité de chiffrage ne se confondent plus | `src/lib/lignes-vendables.ts` |
| **La quantité dictée atteint le CALCUL** — elle vivait en colonne et personne ne la lisait | `caracteristiqueDeLaQuantite` + `src/lib/mesures-prestation.ts` |
| **Quantité physique et quantité commerciale**, formalisées et jamais synchronisées | `src/lib/quantite-commerciale.ts` |
| **« À chiffrer » remplace « 0 € »** ; le devis ne se prépare ni ne s'envoie tant qu'une ligne attend son prix | migration 0070 + `src/lib/preparation-devis.ts` + `src/server/repositories/devis.ts` |
| **Comparabilité V2**, à côté de la V1 jamais réécrite : ordre de grandeur, unité, espèce | `src/lib/comparabilite-prix.ts` |
| **Sa correction tranche** au lieu de bloquer, et aucune extraction ne repasse dessus | `prestations.corrige_par_humain` |
| **`nature` et `espece` viennent de la dictée**, dans une liste fermée et vérifiée | `src/server/ai/schemas/extraction.ts` + `src/lib/prestation-structuree.ts` |
| **Une réponse tronquée cesse d'être une panne muette** | `ResultatLLM.fin` + `estJsonTronque` |

**Ce qui n'est PAS vérifié ici, faute de clé :** ce que le modèle rend vraiment
pour `nature` et `espece`, Whisper, et le `stop_reason` réel. Le §16 du dossier
07 donne le seul test à jouer sur son espace.

**Deux choses lui reviennent :** la planche
`https://florianmarrins0978-svg.github.io/Atlas-app/corriger-une-mesure.html`,
et la question « dessouchage de DEUX souches : faut-il multiplier le prix de
grille par deux ? ».

---
## Le numéro de ses documents se choisit (26 août 2026)

*Sa demande : « dans la catégorie facture il faut rajouter le format de numéro,
c'est obligatoire il me semble ». Puis « garde le F », « 6 chiffres », « oui
remettre à 0 chaque début d'année ». Le détail est dans `ARCHITECTURE.md` §188.*

**Fait.** Réglages → Devis & factures → « Le numéro de mes documents » : cinq
formats, chacun montrant ce qu'il donne, enregistré au fur et à mesure. Le
défaut est « Année et 6 chiffres », le « F » des factures reste, et le compteur
repart à 1 le 1ᵉʳ janvier — sauf sur « une suite sans année », où repartir
ferait deux documents du même numéro.

**Et un défaut à retardement est parti avec.** Le millésime était écrit en dur
dans le dépôt : en janvier 2027, ses factures auraient encore dit 2026. Aucune
suite ne pouvait le voir, puisqu'elles tournent aujourd'hui.

**Ce que ça ne fait pas :** renuméroter les documents déjà émis. Les réécrire
creuserait un trou dans la suite, ce que la loi interdit.

## L'assistant est devenu un agent (26 août 2026)

| | État |
|---|---|
| Dix gestes de plus, tous **proposés** : chantier, client, adresse, note, planning (poser/déplacer/retirer), tarifs, facture | **fait** — `propositions.ts`, `appliquerPropositionsAction` |
| Trois lectures pour viser : `RechercherChantier`, `LireClients`, `LirePlanning` | **fait** — 20 outils au total |
| On vise par **identifiant**, jamais par nom | **fait** — et chaque geste relit sa cible en base à l'écriture |
| Une proposition peut ne concerner **aucun** chantier | **fait** — migration `0067`, `IS NOT DISTINCT FROM` à la réclamation |
| Rien en direct : *« que ça reste le doigt du patron »* | **fait** — aucun geste sans confirmation |
| Envoyer, valider, émettre : **jamais** l'assistant | **fait** — `preparer_facture` s'arrête au brouillon |
| Le hors-sujet refusé **avant** le modèle, avec ses deux conditions | **fait** — `perimetre-assistant.ts` |
| Faux positifs éprouvés (12 questions qui doivent passer) | **fait** — `test-assistant-perimetre.ts` |
| Ce qu'un vrai fournisseur en fait | **non vérifié ici** (aucune clé) — chaîne entière éprouvée par le fournisseur `dev` |

## Trois rôles, trois sessions — qui atteint quoi (25 août 2026)

*Sa demande du 25 août : « chaque utilisateur possède son propre compte et sa
propre session […] les restrictions doivent être appliquées côté serveur, et pas
uniquement en masquant des boutons ». La règle elle-même est tranchée dans
`docs/QUESTIONS.md` §10 depuis le 13 août.*

| | État |
|---|---|
| Trois rôles en base — `proprietaire`, `commercial`, `salarie` ; `membre` repris en `salarie` | **fait** — migration `0065`, contrainte `CHECK` en base |
| La règle « qui atteint quoi », fonction pure et **unique source** | **fait** — `src/lib/acces-roles.ts` |
| Les écrans refusent au serveur, sans qu'aucun ait à y penser | **fait** — `GardeAcces`, dans `src/app/layout.tsx` |
| Les routes d'API refusent, et une route neuve ne peut pas l'oublier | **fait** — `exigerOuverture` ; `scripts/test-acces-routes-gardees.ts` rougit sur un oubli |
| Les actions restent gardées par rôle | **inchangé** — `exigerProprietaire`, plus les quatre gestes des accès |
| Écran Réglages → Équipe → « Qui a accès » : créer un compte, changer un rôle, retirer | **fait** — `src/app/reglages/equipe/QuiAAcces.tsx` |
| Ce qu'un salarié voit du planning : tout, ou son équipe — **par personne** | **fait** — tamis dans `contextePlanning`, jamais à l'écran |
| La barre du bas et le sommaire des réglages suivent le rôle | **fait** — même fonction que celle qui refuse |
| Le dernier patron ne peut ni se rétrograder ni se retirer | **fait** — `donner-un-acces.ts` |
| Isolation entre entreprises sur les accès eux-mêmes | **fait** — éprouvée sous `atlas_app` (`test-acces-roles-db.ts`) |
| **Un commercial LIT les tarifs sans les changer** (règle du 13 août) | **PAS FAIT** — `/reglages/tarifs` et `/reglages/prix` restent au patron seul, comme avant ce lot. Voir `TODO.md` |
| L'assistant est fermé au salarié — il reconstitue chantiers, clients et prix | **fait** — refus dans `poserQuestionAction`, bouton non rendu |
| La connexion mène chacun chez lui, sans renvoi enchaîné | **fait** — `src/server/accueil-apres-connexion.ts` ; sans quoi le salarié voyait une page blanche |
| Vu à l'écran | **fait pour le planning du salarié** (deux onglets, ni assistant ni lien d'agenda) et pour celui du patron (cinq onglets, inchangé). **L'écran « Qui a accès » n'a pas encore été capturé** |

## L'assistant explique l'appli, et sert le patron seul (25 août 2026)

| | État |
|---|---|
| Le mode d'emploi, écrit et cherchable — une soixantaine de gestes, écran par écran | **fait** — `src/lib/mode-emploi.ts`, outil `RechercherModeEmploi` |
| Chaque fiche **prouvée contre le code** (fichier source + morceaux de texte attendus) | **fait** — `scripts/test-mode-emploi.ts`, et le contrôle sait échouer |
| L'assistant récite le geste sans le reformuler, et **dit qu'il ne sait pas** quand il ne trouve rien | **fait** — consigne système + `chercherFiches` rend vide |
| « Comment je supprime… » ne déclenche plus une suppression de données | **fait** — le mode d'emploi passe en tête de la chaîne du fournisseur |
| Aller chercher une ligne dans le devis de n'importe quel client, la poser sur le devis ouvert | **fait** — `RechercherLignesDevis` + proposition `copier_ligne_devis` |
| Le montant est relu en base à la validation, jamais transmis | **fait** — `getLigneDevisPourCopie` ; un test exige que `donnees` ne porte que l'identifiant |
| Isolation entre entreprises sur cette recherche | **fait** — tenue par la RLS, éprouvée sous `atlas_app` avec deux lignes homonymes |
| L'assistant réservé au **responsable** : bouton absent, et les deux actions serveur relisent le rôle | **fait** — `poserQuestionAction`, `appliquerPropositionsAction` |
| Ce qu'un vrai fournisseur en fait | **non vérifié ici** (aucune clé) — la chaîne entière est éprouvée par le fournisseur `dev` ; la formulation d'un modèle réel est à voir sur son espace |

---

## L'échéance de la facture : proposée, modifiable (25 août 2026)

| | État |
|---|---|
| La facture porte une échéance dès sa création, depuis **son délai de paiement réglé** (0 = comptant), 30 j à défaut | **fait** — `factures.ts`, `echeanceFacture` ; plus de « 30 » en dur |
| L'échéance se **corrige** sur l'écran de la facture, tant qu'elle est brouillon | **fait** — `FactureClient`, `majEcheanceFactureAction` |
| Une facture arrêtée fige son échéance (champ caché ET refus serveur) | **fait** — `majEcheanceFacture` refuse hors brouillon |
| Règle de saisie pure (pas avant la facture, pas au-delà d'un an, comptant permis) | **fait** — `src/lib/echeance-facture.ts`, éprouvée sans base |
| Isolation entre entreprises | **fait** — tenue par la RLS (`test-factures`, rôle `atlas_app`) |

---

## Photographier un devis pour en reprendre l'allure (25 août 2026)

| | État |
|---|---|
| L'écran Réglages → Documents porte deux boutons *Photographier mon devis / ma facture*, **en tête** de « L'allure de mes devis » | **fait** — `DocumentsClient.tsx` ; appareil photo **ou** photothèque (`accept="image/*"`, sans `capture`) |
| Lecture de l'allure (couleurs, police reconnue) et des mentions | **fait** — `src/server/ai/services/lire-allure-devis.ts`, même patron que `lire-ticket.ts` |
| Jamais les lignes ni les prix ; jamais le logo (dit en réserve) | **fait** — la réserve du logo est **toujours** posée |
| La photo est nettoyée de ses métadonnées comme le logo | **fait** — `preparerPhotoEntrante` |
| Fonction pure de lecture éprouvée sans clé | **fait** — `scripts/test-lecture-allure-devis.ts`, 0 échec |
| L'appel réel au fournisseur de vision | **NON vérifié ici** (aucune clé) — à jouer sur son espace, comme la dictée |
## Sécurité : lot Audio fermé (26 août 2026)

| | État |
|---|---|
| Le format d'un audio se lit dans ses OCTETS | **fait** — `src/lib/signature-audio.ts`, sans bibliothèque |
| Le type et l'extension rangés viennent du format réel | **fait** — `extensionPour(mimeType)` est morte |
| Les quatre chemins passent par une porte unique | **fait** — 3 contrôles structurels |
| L'IA n'est jamais appelée avant la validation | **fait** — éprouvé en base |
| Une vraie dictée d'iPhone | **ÉPROUVÉE ET RÉUSSIE le 26 août 2026** — sur son propre iPhone, jusqu'à la génération des informations du devis |
| La QUALITÉ de ce que la dictée produit | **LOT SÉPARÉ** — prestations mal organisées, quantités et unités mal lues, prix historiques incohérents (`TODO.md`) |
| Sauvegardes | **toujours aucune** — le point le plus grave du dépôt |

**Batterie complète au vert le 27 août 2026**, sur l'état destiné à `main`
(branche `56f0119`, `origin/main` `3d455ed` intégré) : **259/259** suites base,
**115/115** suites navigateur, connexion réelle derrière une origine étrangère.

Les suites navigateur ont dû être jouées **par tranches**, un serveur neuf par
tranche : `next dev` (Turbopack) monte à 13,5 Go sur ce conteneur de 16 Go, et le
tueur de mémoire abat le serveur. Aucune assertion touchée, aucun délai ajouté,
aucune suite écartée. Cause non établie — voir `TODO.md`.

Rapport transmissible : `docs/lot-audio-rapport.md`. Raisonnement :
`ARCHITECTURE.md` §201.

---

## Sécurité : lot 3 — M9 à M12 et F1 à F13 fermés (25 août 2026)

| | État |
|---|---|
| **M9** — `password_hash` hors de portée d'`atlas_app` | **fait** — trois fonctions `SECURITY DEFINER`, droits par colonne |
| **M10** — les onze alertes de dépendances | **fait** — Next monté à la main en 16.3.2 |
| **M11** — se prouver à nouveau avant un geste sensible | **fait**, plus un contournement de « me déconnecter partout » trouvé hors brief |
| **M12** — la mise à jour du banc réservée au propriétaire | **fait** |
| **F1, F2, F5, F8, F9, F12, F13** | **fait** — aucun n'était une fuite de données |
| **F3** | **inchangé, et gardé** — 5 contrôles neufs contre une variable ajoutée demain |
| **F4, F6** | **faux problèmes** — refusés. Renommer une migration (F6) l'aurait fait rejouer partout |
| **F7** — l'écran RGPD (export / effacement client) | **décision du patron**, aucune interface construite |
| **F10** — la CSP `unsafe-inline` | **réel, lot à soi** — le retirer sans `nonce` casse l'application |
| **F11** | **déjà fermé par le lot 1** |
| `ATLAS_PROXY_SAUTS` en production | **à poser** — sans lui, tous les seuils par source restent communs |
| Sauvegardes | **toujours aucune** — le point le plus grave du dépôt |

**Batterie complète au vert le 26 août 2026** : 232/232 suites base, **110/110**
suites navigateur, connexion réelle derrière une origine étrangère.

Rapports transmissibles : `docs/lot-3-fermeture-f1-f13.md` puis
`docs/lot-3-cloture-et-lecture-audio.md` (clôture + lecture du lot Audio). Le raisonnement complet
est dans `ARCHITECTURE.md` §191.
---

## Sécurité : lot 2B — M3 et M6 fermés (24 août 2026)

| | État |
|---|---|
| Une image n'est **jamais** rangée ni envoyée sans nettoyage | **fait** — porte unique, `ARCHITECTURE.md` §164 |
| Les cinq chemins d'image la traversent (le **logo** compris) | **fait** — 3 contrôles structurels l'empêchent de diverger |
| HEIC/HEIF refusés, avec le geste qui le règle | **fait** (solution B assumée) |
| Le corps d'une requête est borné **pendant** sa lecture | **fait** — `ARCHITECTURE.md` §165 |
| Le type AUDIO reste le type déclaré (aucune signature vérifiée) | **signalé, non traité** — hors M3/M6 |
| Sauvegardes | **toujours aucune** — le point le plus grave du dépôt |

**Batterie complète au vert le 25 août 2026** : 223/223 suites base, 110/110
suites navigateur, connexion réelle derrière une origine étrangère. Verdict
transmissible : `docs/lot-2b-securite-verdict.md`.

**Sept contrôles de suites navigateur ont été réparés au passage**, tous
étrangers au lot : ils attendaient un délai plutôt qu'un signal, ou guettaient
une formulation plutôt qu'une règle (`CHANGELOG.md` du 25 août).

---

## Le lien envoyé au client ne peut plus être une adresse locale (24 août 2026)

Son client lisait « Connexion au serveur impossible » : le lien portait
`localhost`.

| | État |
|---|---|
| Une adresse locale ne part plus dans un message | **fait** (`ouvrableParLeClient`) |
| L'écran le dit, et dit que le rapport est sauf | **fait** |
| `ATLAS_URL_PUBLIQUE` pour un mandataire muet | **fait**, documentée dans `.env.example` |
| Les quatre copies du calcul d'adresse réunies | **fait** (`originePublique`) |
| Le garde-fou confronté à l'état dégradé | **fait** — la suite de la fiche rougit sans adresse déclarée |
| Le même refus sur le devis et la facture | **fait** — les cinq gestes d'envoi le portent |

Le détail et les partis pris : `ARCHITECTURE.md` §169.

---

## La fiche de chantier : supprimer un brouillon, retrouver où elle se compose (24 août 2026)

Ses deux phrases, sur une capture : *« Je ne peux pas supprimer les fiches en
cours »* et *« l'endroit où je pouvais créer ma fiche sur mesure […] a
disparu »*.

| | État |
|---|---|
| Une fiche EN COURS se retire depuis la liste, avec « Annuler » | **fait** (`FichesEnCours`, `supprimerPassage`) |
| Un rapport PARTI ne se supprime pas — et ne porte pas de croix | **fait**, tenu par une suite base ET une suite navigateur |
| L'endroit où la fiche se compose, atteignable en permanence | **fait** — en bas de la liste, propriétaire seulement |
| Créer une catégorie en la NOMMANT | **fait** — elle ne tombe plus dans « Divers » |
| Retirer une catégorie d'un geste | **fait** (`retirerFamille`) |
| Les écrans regardés, pas seulement testés | **fait** — trois défauts corrigés qu'aucune suite ne voyait |

Le détail et les partis pris : `ARCHITECTURE.md` §168.

---

## Choisir la date : un seul geste (25 août 2026)

Sa demande : *« je dois pouvoir sélectionner les jours juste en les touchant,
pas besoin de cliquer sur proposer »*.

| | État |
|---|---|
| Toucher une case propose la date | **fait** |
| Retoucher la retire | **fait** |
| La fiche du jour reste, sans bouton | **fait** (elle dit `proposé`) |
| Un jour refusé s'ouvre et dit pourquoi | **fait** |
| Deux cases touchées coup sur coup | **fait** — le verdict périmé est jeté |
| La planche 91 porte le même geste | **fait** (`appli/choisir-la-date.html`) |

Le détail et les partis pris : `ARCHITECTURE.md` §170.


---

## Le client touché ne remonte plus (23 août 2026)

Son défaut : le client haut sur l'écran disparaît quand on le touche.

| | État |
|---|---|
| La ligne touchée reste immobile sous le doigt | **fait** (`useAncrageDuGeste`) |
| La fiche s'ouvre **vers le bas**, comme au milieu de l'écran | **fait** |
| Sa séquence rejouée au navigateur, à 390 px | **fait** (`test-ligne-planning-e2e.ts`) |
| Le contrôle confronté à l'état dégradé | **fait** — rouge à 422 px sans l'ancrage |

Le détail et les partis pris : `ARCHITECTURE.md` §157.

---

## Sécurité : le lot 2 est corrigé (24 août 2026)

Ce qu'on dépose dans Atlas — photos, tickets, croquis, listes de prix.
`ARCHITECTURE.md` §165.

| | État |
|---|---|
| M5 — bombe de décompression sur l'import de tarifs | **fait** (borne à 32 Mo gonflés) |
| M4 — cadence sur l'import de tarifs | **fait** (les autres chemins l'avaient déjà) |
| M1 — le type servi ne vient plus du navigateur | **fait** (déduit de l'extension) |
| M2 — liste blanche d'images (le SVG passait) | **fait**, sur les quatre écrans |
| M3 — coordonnées GPS retirées des photos et des tickets | **fait** |
| Hors brief — type et cadence sur le croquis d'arrosage | **fait** |
| M6 — plafond d'octets | **déjà en place**, rien touché |

**Ce qui n'est pas fait, et qui ne se règle pas en codant :** les sauvegardes.
Il n'y en a aucune. C'est le point le plus grave du dépôt aujourd'hui
(`TODO.md`).

---

## Face ID : fait (24 août 2026) — sa réponse est **B**

| | État |
|---|---|
| La planche essayable — `appli/face-id.html`, planche 94 | **faite**, et **tranchée : B** |
| La porte — une ligne au-dessus, rien d'autre ne bouge | **faite** (`src/app/login/LigneFaceId.tsx`) |
| Réglages › Connexion : enregistrer, lister, retirer un appareil | **fait** |
| Migration 0063 + règles pures + second fournisseur `Credentials` | **fait** (`ARCHITECTURE.md` §163) |
| Parcouru en navigateur, appareil simulé de Chrome | **fait** (`test-face-id-e2e.ts`) |
| `ATLAS_RP_ID` posée en production | **à faire le jour du déploiement** — sans elle, Atlas refuse d'enregistrer une clé |
| Essayé sur SON iPhone, avec SON visage | **pas fait**, et personne ici ne peut le faire à sa place |

Ce qui est tranché et n'a pas à être rouvert : le mot de passe ne se retire
jamais, le compte se crée au mot de passe, l'activation est par appareil, et un
échec de visage ne compte aucune tentative ratée.

---

## Sécurité : le lot 1 de l'audit est corrigé (23 août 2026)

Un audit hostile complet a été mené sur le dépôt. Le détail des décisions est en
`ARCHITECTURE.md` §162 ; ce qui reste à faire est dans `TODO.md`.

| | État |
|---|---|
| **L'isolation entre entreprises** — 42 tables sur 42 en RLS forcée | **tient**, éprouvée en attaquant, pas en relisant |
| C1 — bourrage d'identifiants (28 800 essais/jour → 103) | **fait** |
| C1 — la protection survit à une panne de Redis | **fait** (compteur en base, migration 0062) |
| C1 — mot de passe à 12 caractères, sans mettre dehors les comptes existants | **fait** |
| E1 — `db:seed` ne peut plus vider une vraie base | **fait** |
| E2 — SSRF par l'agenda iCloud | **fait** (domaine, schéma, adresses internes, redirections) |
| E3 — les prix de vente réservés au propriétaire | **fait**, côté serveur |
| M7 — `trustHost` : une seule source de vérité | **fait** |
| M8 — le profil banc ne peut plus servir en production | **fait** |
| Sauvegardes et restauration | **RIEN** — c'est le premier point du lot suivant |
| M1–M6, M9–M12, F1–F13 | **à faire**, listés dans `TODO.md` |

**Deux variables à poser le jour du déploiement**, et leur absence ne se paie pas
pareil : sans `AUTH_TRUST_HOST` (ou `AUTH_URL`), **plus personne ne se
connecte** ; sans `ATLAS_PROXY_SAUTS`, le seuil par visiteur redevient commun à
tout le monde. La temporisation par compte, elle, ne dépend d'aucune des deux.


## Le plan d'arrosage dessiné (23 août 2026)

Son feu vert : *« très bien, tu peux coder la maquette »*.

| | État |
|---|---|
| Le contour du jardin, **union** des zones lues | **fait** (`terrain.ts`) |
| Le tracé des lignes et la tranchée, depuis la nourrice | **fait** (`trace.ts`) |
| Le dessin à l'écran : cotes, tranchée, réseaux en couleur | **fait** (`PlanDessine.tsx`) |
| Ronds/carrés, pleins/creux, losanges — sa planche du 17 août | **fait** |
| `tés + coudes = arroseurs`, **par réseau** | **fait**, et éprouvé ainsi |
| La tranchée partagée coûte zéro au réseau suivant | **fait** |
| Deux morceaux de terrain : liaison en pointillé + réserve | **fait** |
| **Sans nourrice, aucun plan** — ni dessin ni pièces | **fait** |
| La nourrice lue sur le croquis, jamais déduite | **fait** (`lire-croquis.ts`) |
| Quel arroseur, quelle buse, quelle portée, par réseau | **fait** |

**Non vérifié ici :** la lecture réelle d'une photo de croquis. Cet
environnement n'a aucune clé de vision — le modèle doit maintenant rendre les
positions des zones et l'endroit de la nourrice, et **cela n'a pas pu être
éprouvé** (`AGENTS.md`). C'est le premier essai à faire sur son banc.

Le détail : `ARCHITECTURE.md` §150.

### Discuter le plan (23 août 2026)

| | État |
|---|---|
| Un fil et un **champ libre** sous le plan | **fait** (`DiscuterLePlan.tsx`) |
| Atlas pose une **consigne**, jamais un tracé | **fait** (`consignes.ts`) |
| La discussion ne s'affiche **qu'avec un plan** | **fait**, et éprouvé par l'absence |
| **Aucune phrase pré-écrite** | **fait** |
| La nourrice **ne se discute pas** | **fait**, et l'écran le dit |
| Une référence hors catalogue est **refusée** | **fait**, sans jeter la réponse |
| Rien n'est enregistré — les paramètres voyagent | **fait** |

**Non vérifié ici :** le parcours entier (il faut une clé de vision pour obtenir
un plan). Les règles pures le sont : `test-consignes-arrosage.ts`,
`test-discussion-plan.ts`.

Le détail : `ARCHITECTURE.md` §167.

### Le moins de vannes, pas le moins d'arroseurs (23 août 2026)

| | État |
|---|---|
| Le choix de buse vise **le moins de vannes** | **fait** — l'ancien critère devient le départage |
| Le quinconce ne se resserre plus **sous la portée** | **fait** — sa règle du 17 août |
| Son jardin du 23 août : **2 réseaux** au lieu de 5 | **fait**, et éprouvé |
| Le carré de 12 m : **9 × 3504 buse 0,75** | **fait** — sa pose du 21 août |

Le détail : `ARCHITECTURE.md` §170.

### Lire un croquis à main levée (23 août 2026)

| | État |
|---|---|
| Un croquis **pas à l'échelle** se lit quand même | **fait** (`echelleTolerante`) |
| Le trajet du regard garde sa règle **stricte** | inchangé, et éprouvé |
| La **haie** donne l'échelle, elle aussi | **fait** |
| Dernier recours : la plus grande cote sur l'étendue du dessin | **fait**, marqué « approchée » |
| Un agencement illisible ne retire que le **dessin**, pas le plan | **fait** |
| Le refus n'accuse plus les cotes quand elles sont là | **fait** |
| Les **trois points qui soufflent** pendant la lecture | **fait** (`PointsQuiSoufflent`) |

Le détail : `ARCHITECTURE.md` §149.

### Ses deux corrections du 23 août

| | État |
|---|---|
| La pluviométrie **ne sépare plus** deux vannes | **fait** — *« ne prends pas en compte la pluviométrie »* |
| Le matériel sépare toujours (turbine ≠ tuyère) | inchangé, et éprouvé |
| Un réseau nomme **tous** ses modèles, comptés | **fait** (`materiels`) |
| Les pièces se comptent en **« 13x »**, plus en « 13 u » | **fait**, des deux côtés |
| Les mètres restent des mètres (« 80 ml ») | **fait** |

Le détail : `ARCHITECTURE.md` §151.
## Le planning ne promet plus ce qu'il ne peut pas tenir (23 août 2026)

| | État |
|---|---|
| « Ajouter un chantier » disparaît quand rien n'attend de jour | **fait** (`AjoutAuJour`) |
| Le cul-de-sac « Aucun chantier n'attend de jour » retiré du geste | **fait** — la phrase reste sous « Sans date », à sa place |
| Deux mesures : le bouton part, et il revient | **fait** (`test-planning-e2e.ts`) |

---

## Le mode nuit se lit (22 août 2026)

*« Le mode nuit est illisible. Corrige ça. »* — sa capture du planning.

| | État |
|---|---|
| Ce qu'on écrit sur un aplat plein suit la charte (`surPlein`) | **fait** — 8 endroits, `#faf9f5`/`#fff`/`fill="white"` |
| Les voiles d'encre suivent la charte (`voile()`) | **fait** — calendrier, interrupteur d'agenda |
| Alerte, bordeaux et vert pâle deviennent des jetons de charte | **fait** — teinte gardée, clarté accordée |
| Les cinq chartes claires, intactes au caractère près | **fait**, et fixé par une suite |
| Contrôle sans navigateur, sur les sept palettes | **fait** (`test-chartes-lisibles.ts`) |
| Contrôle qui REGARDE l'écran, Origine contre Nuit | **fait** (`test-mode-sombre-lisible-e2e.ts`) |

Non couvert : les états qui ne s'ouvrent qu'au doigt et les écrans profonds — le
parcours de la suite porte six écrans. Détail : `ARCHITECTURE.md` §160.

---

## Proposer une date : le calendrier du planning (22 août 2026)

Sa demande, validée sur planche 91 puis codée trait pour trait.

| | État |
|---|---|
| Le calendrier du planning dans « Choisir la date » | **fait** (`MoisCharge`, partagé avec l'écran Planning) |
| Toucher un jour dit **qui y est déjà**, avec son équipe | **fait** (`JourneeRegardee`) |
| **Regarder n'est plus retenir** — « Proposer ce jour » engage seul | **fait** |
| Un jour complet reste **touchable** | **fait**, à sa demande |
| La durée va jusqu'à **200 jours** | **fait** (`durees-chantier.ts`) |
| La charge et le chargement partagés, jamais recopiés | **fait** (`useOccupation`, `contextePlanning`) |

Le détail et les partis pris : `ARCHITECTURE.md` §143.

---

## De la dictée au devis : la chaîne part TOUTE SEULE (21 août 2026)

Sa panne de Madame Lucie : il dicte, ferme l'application, revient, clique le nom
— et n'arrive pas sur son devis.

| | État |
|---|---|
| La liste mène au **devis** dès qu'une dictée existe | **fait** (`chantier-etat.ts`) |
| Le devis **se prépare lui-même** en arrivant, sans qu'il appuie sur rien | **fait** (`devis-a-preparer.ts`, `PreparationDictee.tsx`) |
| Sortie de secours si la chaîne échoue : « Ouvrir le devis tel quel » | **fait** |
| La séquence entière rejouée au navigateur | **fait** (`test-madame-lucie-e2e.ts`) |
| La qualité de la rédaction avec une VRAIE clé | **non vérifiée ici** — `npm run verifier:dictee`, sur son espace |

Le détail et les partis pris : `ARCHITECTURE.md` §142.

---

## Diagnostic végétal — le module est prêt, **sa base est vide**

**Posé le 20 août 2026.** Troisième outil de l'onglet Paysage
(`/paysage/diagnostic`), après l'arrosage et la fiche de chantier.

| | État |
|---|---|
| Schéma (12 tables, migration 0056) | **fait** |
| Moteur déterministe : rapprochement, arbitrage, confiance | **fait**, éprouvé sans base ni réseau |
| Observation par un modèle de vision, vocabulaire fermé | **fait** — l'appel réel **non vérifié** ici, faute de clé |
| Écrans : prise de photo, résultat, relance, refus | **faits** |
| Retrait des métadonnées EXIF (JPEG/PNG/WebP) | **fait**, éprouvé sur l'octet |
| Conservation configurable + purge planifiée | **fait** |
| Rattachement facultatif à un chantier | **fait** |
| Import de fiches : schéma, huit refus, traçabilité | **fait**, éprouvé contre des fiches fautives |
| **Contrôle d'intégrité champ par champ après import** | **fait** — bloque la validation au moindre écart, et « validée » est impossible sans lui (contrainte) |
| **L'hôte identifié AVANT la maladie** | **fait** — sans essence établie, Atlas demande une photo puis refuse |
| Classement sémantique | **pas fait** — l'interface et son verrou existent, l'implémentation non |
| **Fiches phytosanitaires réelles** | **3 sur ~50** — fomès des résineux (DSF, 2013), anthracnose du platane et anthracnose du chêne et du hêtre (Ephytia/DSF, 2024) |

**La dernière ligne est le seul vrai reste, et elle n'est pas du code.**

La chaîne entière est éprouvée de bout en bout sur une donnée RÉELLE : récolte
du document officiel → lecture → saisie → contrôles → import → rapprochement →
conclusion (« Fomès des résineux · confiance probable », le plafond venant de la
fiche elle-même, qui déclare qu'une photo ne fait qu'orienter).

**Et la relance photo est éprouvée sur des fiches RÉELLES depuis le 20 août.**
Les deux anthracnoses donnent la même nécrose brune sur une feuille ; sans
l'essence, le moteur ne tranche pas et demande *« Photographiez une feuille
entière, posée à plat. »* — puis conclut à la seconde photo, l'invariant « une
seule relance » tenant. C'est le premier usage réel du mécanisme, et il a fallu
lever deux limites pour l'atteindre : une confusion ne pouvait relier que deux
fiches d'un **même fichier**, et son écriture se perdait **en silence** quand la
fiche visée n'était pas encore en base (`ARCHITECTURE.md` §135).

**Ce qui limite le rythme n'est pas la saisie mais le TYPE de document.** Les
bilans régionaux nomment les problèmes sans décrire les symptômes assez
précisément ; les **fiches-type** le font, et une seule a suffi pour une fiche
complète. INRAE (Ephytia) en contient beaucoup — **sa licence de réutilisation
est le vrai point bloquant**, et c'est une décision, pas du code.

---

## Ce qu'est Atlas

**La direction, dans ses mots (13 août 2026) :** *« créer un deuxième cerveau au
sein de l'application, pour qu'elle s'utilise comme un assistant de gestion /
devis, facture, planning. Elle doit apprendre, enregistrer, s'améliorer,
s'auto-alimenter. »*

**Ce qui apprend déjà :** la mémoire des prix facturés (`lecons_prix`), les cinq
grilles (remplies par les devis réels), la base documentaire. **Ce qui ne retient
rien, par ordre de poids :** le temps réel d'un chantier — donc Atlas ignore si
ses estimations de durée sont justes, alors que c'est la durée qui fait le prix —,
les coûts de chiffrage, les délais de paiement réels, et ce qu'un client refuse.
Le détail est dans `ARCHITECTURE.md` §90 et `docs/QUESTIONS.md` §17.

**L'IA EST BRANCHÉE, et ce n'est plus une hypothèse.** Le patron, le 21 août
2026 : *« il y a une clé IA, il y a Anthropic, elles sont connectées, les deux
clés »*. Sur son espace, la dictée est transcrite, les devis rédigés et les
photos regardées pour de bon — l'arrosage, le diagnostic végétal, le ticket de
caisse. Le poste de l'agent, lui, n'a aucune clé : ce qui en dépend se vérifie
**sur son espace**, jamais ici, et ne se déclare jamais impossible
(`CLAUDE.md` §1 ter).

**La leçon qui commande ce chantier :** `historique_prix` était lue et jamais
écrite. Devant toute idée d'apprentissage, la question n'est pas « avons-nous une
table ? » mais **« qui l'écrit, et à quel moment du parcours ? »**

Un agent au service de l'artisan patron, « comme un comptable » : il prépare les
devis, les envoie au client avec une proposition de date, recueille la réponse,
planifie le chantier, construit la facture à la fin, et tient le relevé de TVA
collectée.

Le parcours complet et ses points d'arrêt sont décrits dans **`docs/AGENT.md`** —
c'est le document de référence du produit.

**Trois arrêts, décidés et non négociables :**

1. Avant l'envoi du devis — une seule question : *une date, ou deux au choix du
   client ?*
2. À la réponse du client — le chantier se planifie, ou revient au patron.
3. Avant le départ de la facture — *rien n'a changé depuis le devis ?*

---

## Terminé et vérifié

**Chercher un client (20 août 2026).** La liste des clients porte une barre de
recherche : il tape un nom, la liste se réduit à chaque frappe. Sans accents,
sans casse, sans ponctuation, et dans n'importe quel ordre de mots. Règle pure
dans `src/lib/recherche-client.ts` (`ARCHITECTURE.md` §134), éprouvée sans
navigateur **et** au navigateur.

### Le socle (antérieur à cette série de travaux)

Chantiers, photos, note vocale, transcription, informations structurées, calcul
du prix, devis PDF, planning, catalogue, réglages tarifs. Authentification
(Auth.js), isolation par entreprise (RLS `FORCE`), stockage de fichiers,
limitation de débit, purge planifiée, journalisation. Assistant IA en lecture
seule avec quinze outils.

### Le parcours entretien : modèle → passage → rapport

Le troisième parcours du produit, à côté de devis → facture. Demandé le 16 août
2026, arbitré sur maquettes, codé les 16 et 18. Le récit complet, les décisions
et ce qui a été écarté : `ARCHITECTURE.md` §128.

| Brique | Où c'est |
|---|---|
| Le modèle de fiche — **un seul par entreprise**, jamais rangé par client | `src/server/repositories/prestations-entretien.ts` (migration `0051`) |
| L'écran où il le compose, retrait réversible | `src/app/reglages/fiche-entretien/` |
| Les règles pures du passage — repli sur le client, temps, empêchements d'envoi | `src/lib/passage-entretien.ts` |
| Le passage et ses lignes **copiées** du modèle | `src/server/repositories/passages-entretien.ts` (migration `0055`) |
| L'outil, dans l'onglet Paysage : ouvrir, cocher, nommer le client, envoyer | `src/app/paysage/fiche/` |
| La page que le client reçoit, lue par jeton sans session | `src/app/entretien/[jeton]/` |

**Trois invariants à ne pas rouvrir :**

- **un rapport parti ne change plus jamais** — les lignes et le nom du client
  sont copiés, pas relus. C'est ce qui en fait une preuve de passage ;
- **le client ne lit que ce qui a été fait**, et le tri est en base ;
- **rien ne part tout seul** : le message se prépare, il l'envoie de sa
  messagerie (`docs/A-FAIRE.md` §5).

**Ce qui n'est PAS fait, et qu'il ne faut pas annoncer** : le PDF du rapport, et
le bouton « J'ai bien reçu » horodaté sur la page du client.

### Le parcours devis → facture

| Brique | Où c'est |
|---|---|
| Envoi du devis au client, une ou deux dates | `src/app/chantiers/[id]/export/EnvoiAuClient.tsx` |
| Canal de communication recueilli à la création du chantier | `src/app/chantiers/nouveau/` |
| Jours libres du patron, calculés une seule fois pour tous les usages | `src/server/disponibilites.ts` |
| Page publique de réponse du client (sans session) | `src/app/devis/[jeton]/` |
| Cycle d'envoi, jeton, expiration, réponse | `src/server/repositories/envois-devis.ts` |
| Suivi de ce que devient le devis (5 états) | `src/lib/etat-envoi.ts` |
| Statut affiché d'un chantier, de brouillon à facturé | `src/lib/chantier-etat.ts` |
| Retoucher le devis à la voix — elle propose, il coche (15 août) | `src/lib/retouches-devis.ts`, `src/server/ai/services/retouches-devis-service.ts`, `src/app/chantiers/[id]/devis-complet/DicterDansLeDevis.tsx` |
| **Et DICTER le chantier dans le devis** (20 août) — il raconte les travaux, hésitations comprises, et obtient des lignes rédigées avec leurs mesures. Aucun prix inventé. La rédaction dépend d'un modèle : `npm run verifier:dictee` la vérifie **là où il y a une clé**, et refuse de rendre un vert sans (`ARCHITECTURE.md` §113) | `src/lib/redaction-lignes.ts`, `src/lib/unites-tarif.ts`, `scripts/verifier-dictee-devis.mts` |
| Le prix accordé au client — remise en % sous le total, jusqu'à la facture (16 août) | `src/lib/reduction-devis.ts`, migration `0048` |
| La fiche d'un client — ses chantiers, ce qu'il doit, ce qu'on lui fait (16 août) | `src/lib/fiche-client.ts`, `src/app/clients/[id]/page.tsx` |
| **Un client est RETROUVÉ, plus recréé** à chaque chantier — rapprochement automatique, refusé si une coordonnée contredit (17 août) | `src/lib/rapprochement-client.ts`, `trouverOuCreerClient` |
| **Et il se RETIRE pour de bon** (17 août) — un « − » en face de la ligne (sa proposition B), écrire 0 %, vider la case, ou le dire à la voix. Les deux derniers chemins étaient cassés : l'écran gardait une remise que la base n'avait plus, et la réécrivait au passage suivant (`ARCHITECTURE.md` §120) | `src/app/chantiers/[id]/devis-complet/` |
| Notification « devis retourné » à l'accueil | `src/app/Notifications.tsx` |
| Reprise d'un devis retourné en nouvelle version | `src/app/chantiers/[id]/export/actions.ts` |
| Onglet « Terminés » et fin de chantier | `src/app/termines/` |
| Facture bâtie depuis le devis, arrêt 3 | `src/app/chantiers/[id]/facture/` |
| **Facture transmise par SMS ou par e-mail**, au choix, coordonnée saisie sur place | `src/app/chantiers/[id]/facture/TransmettreLaFacture.tsx` |
| **Facture téléchargeable**, sous un nom qui porte son numéro | `src/app/api/factures/[id]/pdf/route.ts` |
| **Chemin vers la facture sans passer par la fiche**, et rangement en un seul onglet. Il partait du planning jusqu'au 21 août 2026 ; l'écran refait ne le porte plus, et c'est la liste des « Terminés » qui y mène — sur sa ligne, ou par l'onglet « À facturer » | `src/lib/onglet-chantier.ts`, `src/app/termines/ListeTermines.tsx` |
| Installation sur téléphone : icône, plein écran, marges de sécurité | `src/app/layout.tsx`, `src/app/globals.css`, `scripts/generer-icones.mjs` |
| Relevé de TVA collectée, par trimestre | `src/app/termines/tva/` + `src/server/trimestre.ts` |
| Devis PDF reprenant le modèle du patron, sur autant de pages qu'il faut | `src/server/pdf/devis-pdf.ts` |
| Découpage de la dictée en prestations, matériel, déchets, durée, équipe | `src/server/orchestrateur/analyse-demande.ts` |
| Planning en demi-journées et nombre d'équipes (le client ne voit que la date) | `src/server/disponibilites.ts` + `drizzle/0019_creneaux_et_equipes.sql` |
| Correction demandée par le client, avec son message porté au patron | `src/app/devis/[jeton]/formulaire.tsx` + `src/lib/etat-envoi.ts` |
| Écrire le devis soi-même, sans passer par la proposition de prix | `src/app/chantiers/[id]/informations/InformationsClient.tsx` → `prix?saisie=manuelle` |
| Transmission au client : messagerie ouverte **au bon destinataire**, canal changeable, coordonnée saisissable sur place | `src/app/chantiers/[id]/export/TransmettreAuClient.tsx` |
| **Le contact manquant se saisit dans la feuille d'envoi**, au lieu de renvoyer vers un écran retiré du tiroir (11 août 2026, `ARCHITECTURE.md` §62) | `src/app/chantiers/[id]/export/EnvoiAuClient.tsx` |
| **De la dictée au devis en un seul geste** : prestations, durée, équipe, prix, devis | `src/server/services/devis-depuis-dictee.ts` + `src/app/chantiers/[id]/DevisDepuisDictee.tsx` |
| La dictée est lue mot à mot quand aucun modèle ne répond — et l'écran le dit | `src/server/ai/lecture-litterale.ts` + `drizzle/0021_lecture_dictee.sql` |
| Rédiger le devis **entièrement à la main**, depuis la fiche du chantier | `src/app/chantiers/[id]/page.tsx` → `prix?saisie=manuelle` |
| Durée du chantier à la molette (½ journée → 100 jours), sur les deux écrans | `src/lib/durees-chantier.ts` + `src/app/chantiers/[id]/BandeDuree.tsx` |
| L'espace d'essai se met à jour seul, et l'application annonce sa version | `.devcontainer/mettre-a-jour.sh` + `src/server/version-executee.ts` |
| Créer un chantier sans rien saisir : son nom se déduit du client, de l'adresse, ou de la date | `src/lib/nom-chantier.ts` |
| **Le devis écrit à la main, document entier** : émetteur, IBAN, client, quantités, prix unitaires, TVA, conditions | `src/app/chantiers/[id]/devis-complet/` |
| **Emporter toutes ses données**, en un appui : un ZIP avec les 26 tables, les photos, les enregistrements et les PDF | `src/server/repositories/export-entreprise.ts` + `src/app/api/mes-donnees/` + `src/lib/archive-zip.ts` |
| **L'agent s'arrête et demande ce qui fait le prix** (technique, diamètre), et se tait sur le reste | `src/lib/questions-chiffrage.ts` + `drizzle/0022_precisions_chantier.sql` |
| **Il retient ce que le patron chiffre**, et le lui rappelle sur le chantier comparable suivant | `src/lib/lecons-prix.ts` + `drizzle/0023_lecons_prix.sql` |
| **L'adresse se propose pendant la frappe** et se choisit d'un doigt — Base Adresse Nationale, jamais Google, et le champ reste libre | `src/components/atlas/ChampAdresse.tsx` + `src/server/adresses/base-adresse-nationale.ts` |
| **La note vocale lit un numéro et un e-mail dictés en toutes lettres**, sans qu'il ait à les annoncer | `src/lib/nombres-dictes.ts` + `src/lib/coordonnees-dictees.ts` |
| **L'agenda extérieur, au choix de l'artisan** — Atlas tient compte d'un agenda Google s'il le relie, lit ses créneaux occupés **et leurs intitulés**, et les affiche sur le planning. Ses identifiants Google se collent dans l'application. Sans raccordement, rien ne change | `src/lib/agenda-externe.ts` + `src/server/agenda/` + `src/app/reglages/agenda/` + `drizzle/0032_agendas_externes.sql` + `drizzle/0033_identifiants_google_par_entreprise.sql` |
| **L'agenda iCloud, dans les deux sens** — Atlas lit les créneaux occupés du compte Apple et **n'y propose plus** de date ; s'il l'allume, il pose ses chantiers dans le calendrier qu'il désigne et les retire quand il déplanifie. Les deux fournisseurs se fondent en une seule carte d'occupation. **Réserve : aucun échange réel avec iCloud n'a eu lieu ici** (réseau refusé) — voir `ARCHITECTURE.md` §75 | `src/lib/ics.ts` + `src/lib/caldav.ts` + `src/server/agenda/apple.ts` + `src/server/repositories/agenda-apple.ts` + `drizzle/0035_agenda_apple.sql` |
| **Le vocabulaire du métier**, écrit une fois et envoyé avec chaque dictée — réservé à l'éditeur. Vingt-sept entrées tirées de devis réels (huit règles, dix-neuf mots) ; budget de 9 000 caractères dont un quart réservé à ses corrections, et tout tient aujourd'hui à cinq cents caractères près | `src/app/reglages/vocabulaire/` + `src/lib/consigne-metier.ts` + `drizzle/0030_vocabulaire_devis_reels.sql` + `drizzle/0031_vocabulaire_corrige.sql` |
| **Le devis se découpe en lignes vendables** : abattage + broyage + évacuation ensemble, la fente à part, sans point-virgule | `src/lib/lignes-vendables.ts` |
| **Cinq grilles de prix** — abattage (technique × diamètre), fendage (hauteur × diamètre), dessouchage (diamètre), haie (au ml), grumes (à la tonne) — nées vides et remplies par ses devis | `src/lib/grille-prix.ts` + `src/app/reglages/prix/` + `drizzle/0029_grumes_a_la_tonne.sql` |
| **Le retour de la messagerie ramène à l'accueil**, avec un mot qui dit ce qui a été transmis | `src/lib/annonce-transmission.ts` + `src/components/atlas/AnnonceTransmission.tsx` |
| **Proposer une date jusqu'à 18 mois**, sans montrer au client plus de trois semaines autour | `src/server/disponibilites.ts` (`fenetrePatron`, `bandesVisibles`) |
| **Un calendrier des deux côtés**, où les jours déjà pris sont barrés et ne se choisissent pas | `src/lib/calendrier.ts` + `src/components/atlas/Calendrier.tsx` |
| **Déposer sa liste de prix Excel ou CSV**, avec aperçu avant écriture | `src/app/reglages/ImportTarifs.tsx` + `src/lib/import-tarifs.ts` + `src/server/import/lire-classeur.ts` |
| **La TVA quand le client PAIE, et non quand la facture part** — le relevé se calcule sur la date du règlement (défaut légal d'une prestation de services, CGI art. 269-2-c) ; les factures parties attendent dans « Ma TVA » et y entrent d'un appui. Les acomptes n'apportent que leur part. Réglage encaissements / débits. Le passé ne bouge pas : la migration a supposé réglées les factures déjà émises, et le dit (`ARCHITECTURE.md` §110) | `src/lib/exigibilite-tva.ts` + `src/server/repositories/paiements-facture.ts` + `src/app/termines/tva/` + `drizzle/0045_paiements_et_exigibilite.sql` |
| **Ses tranches et ses travaux, au lieu des nôtres** — les diamètres, les hauteurs, les façons d'abattre et les travaux s'ajoutent et se retirent (écran « Mes prix » et écran « Mes mesures »). Retirer n'efface aucun prix : les cases sont rangées et reviennent. Un travail ajouté n'est PAS reconnu par le chiffrage depuis une dictée, et l'écran le dit (`ARCHITECTURE.md` §105) | `src/lib/grille-prix.ts` + `src/server/repositories/grilles-reglables.ts` + `src/app/reglages/prix/` + `drizzle/0041_tranches_et_natures_de_grille.sql` |
| **L'unité d'un tarif se CHOISIT** dans un bandeau déroulant (jour/homme, m², ml, heure, forfait, tonne, « aucune ») — la case reste libre pour le stère et l'arbre. Ce qu'elle évite : le rapprochement se fait à la lettre près, et « jours/homme » mal tapé faisait cesser la multiplication en silence (`ARCHITECTURE.md` §101) | `src/lib/unites-tarif.ts` + `src/components/atlas/ChoixUnite.tsx` + `src/app/reglages/ReglagesClient.tsx` |

### Le plan d'arrosage automatique — les maquettes, ESSAYABLES depuis le 17 août 2026

**Ce titre disait « rien n'est codé » : ce n'est plus vrai depuis le 20 août.**
L'outil vit dans l'application — voir §« Le plan d'arrosage vit DANS
l'application » plus bas. Ce qui suit décrit les **maquettes** de `appli/`, qui
restent la référence du calcul et l'endroit où il essaie une idée avant qu'elle
soit codée.

**Du croquis au plan, sa demande du 18 août :** *« une fois que j'ai envoyé la
photo, il y a le petit encart où on choisit la marque. Tout ce qu'il y a en
dessous, tu peux le supprimer. Et tu me fais le plan en couleur avec les
différents réseaux [...] et la liste des pièces à acheter. »*
→ **`appli/arrosage-croquis.html`** : un seul écran de saisie (la photo, la
marque), puis le plan en couleur et les pièces rangées en casiers. La lecture de
la photo y est **simulée**, et la page le dit en rouge ; le plan et la liste,
eux, sont vraiment calculés.

**Le calcul est commun aux deux pages : `appli/arrosage-calcul.js`.** Il n'a pas
été recopié — cette liste est ce qu'il commande chez son fournisseur, et deux
versions qui divergent font deux camions de pièces (`ARCHITECTURE.md` §126).

**La page qui calcule pour de bon : `appli/arrosage.html`**, publiée avec
l'appli, donc ouvrable au téléphone. Point d'eau, zones, secteurs, durées par
saison, plan et liste du matériel : tout se refait à chaque frappe.

**Sa décision sur la sortie, le 17 août :** *« il faut simplement créer le plan
et la liste du matos à acheter, ensuite moi j'envoie à mes fournisseurs, ils me
font un devis, puis je repasse par le circuit normal de l'application. »* Donc
**aucun prix** dans cet outil — le devis client emprunte le parcours qui existe.

### Le raisonnement, en trois planches sans JavaScript

**Sa demande :** *« un outil pour les paysagistes pour réaliser des plans
d'arrosage automatique. »* Terrain neuf : le produit ne parlait pas d'arrosage.

Trois planches, **aucune ligne de `src/`** : `docs/maquettes/69` (par où il entre
son jardin : la feuille, les zones, le plan dessiné), `70` (le découpage en
secteurs — rien à y choisir, c'est de l'arithmétique), `71` (ce qui en sort : le
devis, la carte du coffret, le plan client).

**Ce qui attend sa décision** : par où il entre, et par quelle sortie on
commence. Ma recommandation, écrite sur les planches : **les zones**, puis **le
devis** — c'est la seule entrée qui rend du temps de bureau, et la seule sortie
qui n'ouvre aucune plomberie nouvelle. Le détail est dans `TODO.md`
§ « 0 quaterquadragies ».

**Ce qui est déjà su du métier, et qui ne se rediscutera pas** : le débit se
mesure au seau ; une seule pluviométrie et un seul rythme par secteur ; aucun
prix inventé ; rien ne part tout seul. Les pertes de charge restent hors du
calcul, et c'est dit sur la planche plutôt que passé sous silence.

### Apparier deux demi-journées, par la route (16 août 2026)

Sa demande du 13 août — *« proposer deux demi-journées pour faire une journée,
mais de deux chantiers qui sont les plus proches »* — et sa décision du 16 :
**par la route**, après vérification du service de l'IGN sur une machine qui a
le réseau.

| Brique | Où c'est |
|---|---|
| Les règles pures : vol d'oiseau, seuil, classement, phrase affichée | `src/lib/appariement-demi-journees.ts` |
| Le trajet demandé à la Géoplateforme de l'IGN — sans clé, sans compte | `src/server/itineraire/geoplateforme.ts` |
| L'assemblage : rattrapage des coordonnées, présélection, appels, classement | `src/server/planning/appariement.ts` |
| Les coordonnées d'un chantier, et l'adresse qui les a produites | `drizzle/0049_coordonnees_chantier.sql` |
| ~~Le bandeau sous la journée dépareillée~~ — **retiré de l'écran le 21 août 2026** : la planche 84 n'en porte pas. Le calcul, lui, reste | `src/server/planning/appariement.ts` |
| La vérification du vrai service, là où il y a du réseau | `.github/workflows/itineraire.yml` |

**Ce qui protège le service public** : le vol d'oiseau classe et écarte d'abord,
chez nous, sans appel ; la route ne départage que les trois premiers. **Ce qui
ne sort pas d'Atlas** : deux paires de nombres, jamais un nom ni une adresse en
clair — tenu par un contrôle (`scripts/test-itineraire-ign.ts`).
`ARCHITECTURE.md` §117.

### Conformité RGPD

| Brique | Où c'est |
|---|---|
| Registre des traitements, sous-traitants, conservation | `docs/RGPD.md` |
| Grille de choix des fournisseurs d'IA, et leurs tarifs relevés | `docs/TRANSCRIPTION.md` |
| Relevé des tarifs d'IA à leur source (le réseau de l'agent les refuse) | `.github/workflows/relever-tarifs-ia.yml` |
| Refus de démarrer en production avec l'IA simulée | `src/server/env.ts` |
| Ce que l'application utilise vraiment, dit à l'écran | `src/lib/etat-ia.ts`, `src/app/reglages/` |
| Acceptation des documents légaux, avec empreinte | `src/app/documents-legaux/` |
| Purge de l'audio après transcription réussie | `src/server/retention.ts` |
| Export des données d'un client | `src/server/repositories/donnees-client.ts` |
| Effacement d'un client, respectant la conservation légale | idem |

### Le numéro du client, pris pour un téléphone (13 août 2026)

Deuxième passe sur le même défaut. Le 12 août, l'en-tête `format-detection`
avait été posée et annoncée comme réglant l'affaire ; le 13, le patron ouvre son
devis **depuis un SMS** et reçoit la même « Hydration failed », signature d'iOS
comprise — sur un banc à jour, vérifié par sa fiche d'état. Une vue intégrée à
Messages ne lit pas cette en-tête, et c'est le seul chemin par lequel son client
arrive sur la page.

| Brique | Où c'est |
|---|---|
| La règle : découper un numéro pour qu'il ne ressemble plus à un téléphone | `src/lib/numero-document.ts` |
| Ce qui répare vraiment — la coupure du texte aplati par `inline-flex` | `src/components/atlas/NumeroDeDocument.tsx` |
| Contrôles purs, sans navigateur | `scripts/test-numero-document.ts` |
| Le texte réellement aplati, lu sur un VRAI devis | `scripts/test-detection-automatique-e2e.ts` |
| Le pourquoi, le coût assumé et ce qui reste non prouvé | `ARCHITECTURE.md` §81 |

**Non éprouvé ici, et ça ne peut pas l'être** : la détection appartient à un
logiciel fermé d'Apple, absent de cet environnement. À faire confirmer par le
patron, depuis ses SMS (`TODO.md`).

### Le jour barré qui se faisait passer pour un jour pris (16 août 2026)

L'écran refusait une date sans dire pourquoi, et la phrase désignait une
occupation qui n'existait pas. La règle, elle, était juste : un jour vide se
barre quand la durée du chantier déborderait sur un lendemain plein.

| Brique | Où c'est |
|---|---|
| La phrase, et le cas reproduit qui la justifie | `src/lib/jours-barres.ts` |
| Le calendrier — le même pour le patron et pour son client | `src/components/atlas/Calendrier.tsx` |
| Contrôles purs : le fait, la phrase, et la consigne côté client | `scripts/test-jours-barres.ts` |
| Le pourquoi, et ce qui n'a PAS changé | `ARCHITECTURE.md` §115 |

### L'écran d'erreur qui ne menait nulle part (11 août 2026)

Un serveur redémarré sous un onglet resté ouvert, et les morceaux de code
changent de nom. Le patron a lu « Failed to load chunk » avec pour seul recours
un « Réessayer » qui refait le même rendu, avec les mêmes adresses mortes.

| Brique | Où c'est |
|---|---|
| La décision : reconnaître, recharger une fois, savoir s'arrêter | `src/lib/reprise-erreur.ts` |
| Le corps commun des neuf écrans d'erreur | `src/components/atlas/CorpsErreur.tsx` |
| Contrôles purs, dont son message exact et les cinq formulations de navigateurs | `scripts/test-reprise-erreur.ts` |
| La panne rejouée dans un vrai navigateur, à l'écran du patron | `scripts/test-reprise-morceau-e2e.ts` |
| La capture, pour regarder l'écran | `scripts/capture-reprise-morceau.mts` |
| Le pourquoi, et ce qui n'est pas couvert | `ARCHITECTURE.md` §63 |

### La session fantôme (10 août 2026)

Un cookie Auth.js est signé : il survit à la disparition du compte qu'il
désigne. Refaire le jeu de démonstration suffisait à enfermer le patron
dehors — l'application le laissait entrer, puis refusait toute écriture.

| Brique | Où c'est |
|---|---|
| Route qui efface les cookies et renvoie à la connexion | `src/app/api/session-perimee/route.ts` |
| Contrôle du compte, dans le **layout** (307 sans JavaScript) | `src/components/atlas/GardeDocumentsLegaux.tsx` |
| Compte disparu ≠ compte sans entreprise | `src/server/session-ctx.ts` |
| Contrôle, cinq points dont un navigateur sans JavaScript | `scripts/test-session-perimee-e2e.ts` |
| Le pourquoi, et les trois défauts trouvés à l'essai | `ARCHITECTURE.md` §54 |
| Le port du banc, rendu public à **chaque allumage** (le déclarer ne suffit pas) | `.devcontainer/ouvrir-port.sh` + `scripts/test-ouvrir-port.ts` |
| Un seul banc à la fois, et le veilleur ne tue plus la bascule | `.devcontainer/bascule-en-cours.sh` + `scripts/verrou-banc.mjs` + `scripts/test-bascule-veilleur.ts` (`ARCHITECTURE.md` §56) |

### La refonte de l'interface (10 août 2026)

**Mise à jour du 16 août 2026 :** « Nouveau chantier » a grossi — *« les
capitales, gros et très gras »*, choisi sur `docs/maquettes/67` : 13 px,
graisse 800, 0,22 em, rond de 42 px. `docs/maquettes/24-le-bouton-retenu.html`
n'est plus la référence du libellé et porte un bandeau qui le dit ; elle reste
celle du geste (onde, tours, grains), qui n'a pas bougé.

Le patron a arrêté un écran après une soirée de maquettes
(`docs/maquettes/`, treize propositions), puis l'a fait poser dans
l'application. Ce qui est **fait** :

- **L'accueil** : le fil qui porte les jours, la perle d'or qui se tient à
  mi-hauteur et désigne le chantier qu'on regarde, puis descend sur le dernier
  jour quand on arrive au bout (corrigé le 11 août 2026 : elle était posée sur le
  chantier en attente, donc tout en bas chez le patron — `ARCHITECTURE.md` §59),
  le trait qui glisse sous les onglets, et « Nouveau chantier » qui monte en
  feuille pendant que la liste recule. **Le fil glisse librement depuis le 11
  août 2026** : `scroll-snap-stop: always` l'arrêtait à chaque chantier — le
  patron le lisait comme du saccadé — et aucune zone qui défile ne montre plus
  sa barre grise. Le masque en dégradé et l'animation d'opacité sont hors de
  cause, c'est **mesuré** (`scripts/mesurer-fluidite-fil.mts`) : ne pas les
  accuser sans relancer la mesure.
- **Le devis, en tête et dans sa synthèse** (13 août) : le chantier ne s'appelle
  plus « Chez Martins » mais « Mr. Martins », et la carte pose le nom
  au-dessus du détail au lieu de les coller par un tiret. La civilité vit dans
  `src/lib/civilite.ts` — **et c'est un défaut, pas une donnée** : sans champ de
  civilité sur la fiche client, une cliente était nommée « Mr. ». **Tranché le
  soir même** : deux pastilles « Mr » / « Mme » au-dessus du nom, **à la création
  seulement** — sur le devis, le mot s'écrit, il ne se choisit pas (le devis est
  le document, pas la fiche). Recopiées sur le devis et la facture. Un client sur
  lequel il n'a rien touché garde l'apparence qu'il avait avant. Le message tout prêt l'aborde de la même façon (« Bonjour
  Mr. Martins »), et l'encart du client porte une phrase qui l'invite à écrire.
  `ARCHITECTURE.md` §77.
- **Le devis à la main** : ses trois zones de texte mesurent leur hauteur au
  lieu de l'estimer (11 août 2026). Elles comptaient les caractères ou les
  retours à la ligne, alors qu'un texte se coupe au mot : le devis cachait 24 px
  de ce que le patron venait d'y écrire.
- **Planning, Terminés, Réglages, relevé de TVA, fiche chantier** : même
  en-tête, mêmes rayons, mêmes capitales.
- **Les six écrans d'étape** : en-tête et boutons. Les corps de **Photos**, de
  **Note vocale**, d'**Informations** et de **Prix** aussi — plus l'en-tête
  d'Informations, oublié le matin même parce que cet écran ne fait pas partie
  des « six ».
- **La typographie** : plus aucune police téléchargée. L'application prend
  celles de l'appareil, comme la maquette que le patron a validée.
- **Le retrait, partout** (10 août, au soir) : le texte glisse, « Retirer » se
  découvre, la ligne tombe, un tiroir la retient. **Huit** endroits, une seule
  mécanique là où il y en avait trois. Les panneaux « Supprimer … ? »
  disparaissent : la sécurité passe d'une confirmation avant à une
  réversibilité après, et **rien n'est écrit tant que le tiroir est ouvert**.
  `ARCHITECTURE.md` §48.
- **L'anneau muet et la pellicule** (10 août, au soir) : sur la fiche
  chantier, la ligne « Note vocale » devient un anneau qu'on touche pour
  écouter — le compteur suit la lecture réelle et l'onde le volume réellement
  enregistré, pas un décor — et les photos une pellicule dans le tiroir du bas,
  case « + » en tête. `ARCHITECTURE.md` §49.
- **La pellicule ajoute sur place, et l'écran Photos n'existe plus** (11 août) :
  le « + » du tiroir ouvre directement le menu du téléphone — *Photothèque ·
  Prendre une photo · Choisir les fichiers* — au lieu de charger un écran puis
  d'y poser une feuille maison. Quatre gestes deviennent deux. Ajouter, regarder
  et retirer se font dans la pellicule ; `/chantiers/[id]/photos` répond 404, et
  une suite le vérifie. `ARCHITECTURE.md` §60.
- **La TVA due, les achats et le scanner de tickets** (13 août) : l'écran porte
  collectée, déductible et reste à payer — chacun copiable. Les achats entrent
  par l'appareil photo ou au clavier (`achats_tva`, migration
  `drizzle/0036_achats_tva.sql`). La lecture d'un ticket est branchée sur les
  clés du patron ; **la vision a dû être ajoutée à la couche IA**, qui ne
  manipulait que du texte. Ce qu'elle rend est une proposition : c'est ce qu'il
  confirme qui compte. Un crédit de TVA s'affiche en négatif, signe et phrase.
  **NON VÉRIFIÉ ICI : la lecture d'un vrai ticket** — pas de clé sur le poste de
  l'agent. **Chez lui, elle est posée et l'IA tourne** (`CLAUDE.md` §1 ter) :
  c'est un moyen de mesure qui manque ici, pas une fonctionnalité.
  `ARCHITECTURE.md` §84.
- **Un ticket daté d'un autre mois ne disparaît plus** (13 août) : le patron
  ajoute un ticket du 24 juillet depuis l'écran d'août ; il était enregistré —
  dans juillet — et **invisible**, l'écran ne montrant qu'une période. La
  feuille annonce désormais la destination avant qu'il appuie, et l'écran l'y
  emmène après. `scripts/test-achat-hors-periode-e2e.ts`, `ARCHITECTURE.md` §91.
- **Une équipe peut partir cinq jours** (14 août) : les absences se notent dans
  Réglages → Équipe, sous les noms (`docs/maquettes/55`, proposition A). Une
  équipe absente **ne compte plus** dans les dates proposées — l'absence est
  traitée comme une occupation, ce qui la fait entrer dans les **quatre**
  calculs de capacité sans changer une signature. Migration
  `drizzle/0044_absences_equipe.sql`. Si toute l'entreprise part, l'agenda
  Google suffisait déjà et rien n'a été écrit pour ça. **Reste faux, et dit :**
  l'équipe d'un chantier est une étiquette, pas une contrainte.
  `ARCHITECTURE.md` §109.
- **Poser une date à la main, enfin possible** (17 août) : *« je peux toujours
  pas poser de date sur les chantiers test »*. Le geste marchait de bout en bout ;
  c'est le RACCORD qui manquait — en touchant un chantier de « Sans date »,
  l'écran écrivait « À poser » et ne bougeait pas, le calendrier restant 231 px
  au-dessus du haut de la fenêtre. `amenerAuCalendrier` existait déjà et
  annonçait servir « depuis deux endroits » : la liste ne l'a jamais appelée.
  **Aucune suite ne le voyait parce que Playwright fait défiler avant de
  cliquer** — un contrôle qui clique éprouve qu'une cible existe, jamais qu'elle
  est atteignable. `ARCHITECTURE.md` §127.
- **« Adresse non renseignée » ouvre l'écran du chantier** (17 août) : la mention
  de l'accueil devient un lien vers `/chantiers/[id]/coordonnees` — l'écran de
  création rouvert, prérempli, qui **enregistre** au lieu de créer. Sa demande,
  puis sa correction : *« que ça m'amène sur la page que je t'ai envoyée sur la
  deuxième photo. Rien de plus, rien de moins. »* **La mention SEULE est la
  cible** : le nom du chantier garde sa reprise du 13 août. **Le nom du chantier
  se recalcule** à l'enregistrement — sans quoi la ligne dirait « Chantier du … »
  pour toujours, le défaut corrigé partout sauf là où il l'a vu. Deux mots
  changent parce qu'ils mentiraient : « Nouveau » et « Créer le chantier ».
  `ARCHITECTURE.md` §124. **Leçon : devant une demande qui touche à un écran,
  chercher d'abord si l'écran existe** — une première planche avait dessiné une
  fiche client de toutes pièces.
- **Le rappel « facture impayée »** (16 août) : le **quatrième** rappel, et le
  seul qui porte un **rythme**. Sa demande : *« faut faire a plus b, mais il faut
  également qu'on puisse régler […] toutes les semaines ou tous les quinze jours,
  mais pas qu'il y ait la notification tous les jours. »* Il paraît à l'échéance
  — envoi **+ le délai de paiement** réglé, ou le jour de l'envoi sinon —, montre
  le **reste dû** (avec le total quand un acompte est arrivé), et s'éteint tout
  seul dès que le règlement est enregistré. « Plus tard » ne classe rien : il
  espace le rappel du rythme choisi, et c'est le **seul moteur** de ce rythme —
  sans geste, la carte reste, parce qu'une carte qui s'endort seule peut passer
  un jour où il n'ouvre pas l'application. La date de report vit sur le
  **chantier**, pas sur la facture : `trg_facture_immuable` refuse toute écriture
  sur une facture émise, et l'affaiblir aurait été un contournement. Migration
  `drizzle/0050_rappel_facture_impayee.sql`, `ARCHITECTURE.md` §118.
  **Deux défauts trouvés sur la capture et par aucun test** — « 1 jours après
  l'échéance », et deux espaces mangées par JSX autour d'un `<b>`. Le contrôle
  écrit contre le premier ne mesurait rien : la valeur d'un `<input>` ne figure
  pas dans `innerText`.
- **Le rappel du devis qui tarde** (16 août) : un **troisième** rappel dans
  Réglages → Notifications — *« Chantier sans devis »*, 4 jours, allumé
  d'origine —, et sa carte **teintée** à l'accueil avec le compte des jours dans
  l'étiquette (« DEVIS EN ATTENTE · 14 JOURS »). Sa demande du 14 août, ses
  décisions du 16 : *« la B et 4 »*, puis *« le G »*. Il ne se déduit d'aucun des
  deux rappels codés le 14 : ceux-là partent d'un ENVOI, et un devis jamais parti
  n'en laisse aucun — celui-ci se lit sur le chantier. Deux règles y sont
  gratuites : il s'efface seul quand le devis part, et un chantier terminé sans
  devis ne réclame plus rien. Migration `drizzle/0046_rappel_chantier_sans_devis.sql`.
  **Le ton lui a été reposé, capture à l'appui — il garde le sien** (« le B »,
  16 août) : c'est le seul des trois rappels où rien n'est encore parti au
  client. **Et le rang est tranché aussi** (« fait la B », 16 août, après trois
  photos) : sur l'accueil, **les rappels passent devant les réponses de
  clients** — ce qu'il doit faire avant ce qu'on lui a répondu —, **avec une
  place garantie à chaque sorte** pour qu'une pile de rappels ne puisse pas
  enterrer un refus (`src/lib/ordre-notifications.ts`). `TODO.md` §0 novivicies.
- **Une carte ne peut plus se reposer à moitié coupée** (16 août) : sa capture —
  *« le premier message est trop haut et le début n'est pas visible »*. Le cadre
  qui défile déclarait `scroll-snap-type` sans qu'aucun enfant n'ait jamais
  déclaré de point d'accroche : la propriété était **inerte depuis le premier
  jour**. Une carte s'arrête désormais à 24 px du bord, hors du fondu de 18 px.
- **« Surtout la page équipe » : l'écran jamais préparé d'avance** (14 août) :
  le banc compile ses écrans à l'avance, mais la liste — écrite à la main —
  ignorait les **sept sous-écrans de Réglages** créés depuis. « Équipe »
  s'ouvrait donc à froid pendant la construction, au-delà de la minute que le
  relais de GitHub accepte. La liste est désormais confrontée aux dossiers
  réels. Et un **bandeau** dit « Version rapide en construction — 12 écrans sur
  19 » puis s'efface seul, pour ne plus confondre « ça bâtit » et « c'est
  cassé ». **Écarté après mesure : bâtir en priorité basse** (aucun gain, la
  contention est le disque). `ARCHITECTURE.md` §103, `docs/maquettes/46`.
- **La TVA au mois ou au trimestre, et son calendrier** (12 août) : Réglages
  porte le choix, le mois coché d'avance — c'est le défaut légal (déclaration
  CA3 mensuelle ; le trimestre est une option sous 4 000 € de TVA due). L'écran
  de TVA et son calendrier suivent : douze pavés ou quatre. **Atlas ne dit
  jamais lequel s'applique** — le seuil porte sur la TVA due, or il ne connaît
  que la collectée. Migration `drizzle/0035_periodicite_tva.sql`.
  `ARCHITECTURE.md` §83.
- **« TERMINÉS » REFAIT** (22 août) : *« je la trouve beaucoup trop compliquée ;
  un utilisateur qui ne connaît pas l'application n'y comprend rien »*. Trois
  simplifications dessinées (planche 90, `appli/termines-simple.html`), **il a
  pris la B**, codée le soir même. **Un seul mois à la fois, qu'on feuillette**
  — `‹ Août 2026 ›`, et un mois vide répond « Rien en juillet 2026 ». **Ce qui
  reste à facturer NE SUIT PAS le mois** : l'onglet « À facturer » montre tout,
  tous mois confondus, parce qu'un chantier de juillet jamais facturé doit
  rester sous ses yeux en août. Les codes graphiques — fil, perles pleines ou
  creuses, pastille dorée, volet replié — sont remplacés par des **mots** :
  « Pas encore facturé », « Facturé le 20 août ». Le compte des factures est en
  **noir gras**, à sa demande. `src/lib/termines-par-mois.ts` porte les règles,
  `ListeTermines.tsx` l'écran. `CHANGELOG.md` du 22 août.
- **LE PLANNING REFAIT** (21 août) : *« cette page est beaucoup trop compliquée
  à comprendre pour les utilisateurs »*, puis deux soirées de maquette, neuf
  corrections, et *« code trait pour trait cette maquette »*. Le mois reste au
  mois — c'est lui qui sert à viser une date lointaine — et la semaine ne
  gouverne que la liste des planifiés. La **fiche du jour est bâtie sur le
  CHANTIER** : son nom une fois, ses demi-journées dessous, sans trait entre
  elles. Un chantier porte **plusieurs équipes, indépendantes le matin et
  l'après-midi** (migration `drizzle/0058_equipes_par_demi_journee.sql`, la
  colonne `chantiers.equipe_id` retirée). Le quota **prévient sans interdire**.
  `ARCHITECTURE.md` §129.
- **La feuille de chantier : le devis sans un seul prix** (21 août) : *« le
  salarié ne doit pas avoir accès au prix [...] le plus simple, ça serait de
  mettre le devis en PDF sans les prix »*. Ce n'est pas un document de plus —
  c'est le devis lui-même, rendu sans ses colonnes de prix (`sansChiffrage`,
  déjà employé par la fiche de chantier). Et les gestes de « Y aller » y vivent
  désormais : Maps, Waze, copier l'adresse, appeler le client — quatre, plus
  cinq. `src/app/api/chantiers/[chantierId]/feuille/pdf/`.
- **« Y aller » : l'adresse du chantier jusqu'au GPS** (12 août) : liens
  universels et jamais `waze://`, qui échoue en silence quand l'application
  manque. Sans adresse, rien ne s'invente : les destinations s'éteignent.
  Retenu après quatre maquettes (`docs/maquettes/29` à `32`). Les gestes ont
  déménagé dans la feuille de chantier le 21 août ; la règle pure, elle, n'a pas
  bougé (`src/lib/itineraire.ts`). Le bouton « Maps » ouvre **Google Maps**
  depuis le 31 août — c'est Plans d'Apple qui est sorti, pas Google.
  `ARCHITECTURE.md` §70.
- **Le planning au mois, et les équipes nommées** (10 août, au soir) : sept
  colonnes sans bordure et la journée qui s'ouvre sous le calendrier. Réglages
  laisse nommer les équipes — mais **seulement à partir de deux** : seul, le mot
  « équipe » ne s'écrit nulle part. Une table `equipes` (`nom` nullable) et une
  seule fonction pure qui décide du libellé. Les cinq marques d'occupation ont
  été remplacées le 21 août par quatre états qui se remplissent à la proportion.
  `ARCHITECTURE.md` §51, §52 et §129.
- **« Terminés » et le parcours de facturation** (10 août, au soir) : un fil par
  mois, l'encart « à facturer » posé DANS le mois et replié au repos, le relevé
  de TVA en simple ligne au pied. « Fin de chantier » s'appelle désormais
  **« Créer la facture »** — mais créer n'est toujours pas envoyer.
  `ARCHITECTURE.md` §53.
- **La fiche chantier tenue à sa maquette, et l'anneau qui dicte** (11 août) :
  le corps ne porte plus que l'anneau, au centre, **présent dès l'arrivée**.
  Sans note il est un micro — un appui dicte, un second enregistre, la fiche se
  rafraîchit sur place ; avec, il redevient le lecteur. Le bouton principal, la
  rédaction à la main et les étapes descendent dans le tiroir : la fiche dit
  toujours quoi faire ensuite, mais depuis son bandeau. L'en-tête suit la
  maquette (client en serif **avant** le titre, pastille sur la ligne de la
  flèche, pas de trait de fermeture), par trois réglages **facultatifs** de
  `EnTeteEcran` qui laissent les autres écrans intacts. `ARCHITECTURE.md` §57.
- **De l'anneau au devis, en une touche** (11 août, soir) : un appui dicte, un
  second arrête, et « MON DEVIS → » naît sous l'anneau — transcription,
  informations, prix, rédaction, et l'on arrive sur `devis-complet` sans écran
  intermédiaire. La chaîne lance elle-même la transcription, ce qui manquait.
  Le tiroir ne garde que Photos, Note vocale et Devis à la main ; les écrans
  retirés restent joignables par leur adresse.
  `scripts/test-anneau-vers-devis-e2e.ts`.
- **Le devis à la main s'ouvre depuis la création du chantier** (11 août) : un
  lien discret sous « Créer le chantier ». Le chantier est créé, puis le devis
  s'ouvre avec le client déjà en en-tête — nom, adresse, téléphone. La porte du
  tiroir reste : ce sont deux moments, pas deux chemins.
  `scripts/test-devis-main-depuis-creation-e2e.ts`.
- **Les suites mesurent l'écran du patron, et cherchent ce que le doigt
  n'atteint pas** (11 août) : le cadre vit à un seul endroit
  (`ECRAN_DU_PATRON`, 390 × 664 au lieu des 393 × 852 qu'on posait — la dalle
  d'un iPhone, pas la place réelle d'une page). Quarante-et-une suites et
  vingt-neuf scripts de capture en héritent. Le cadre honnête n'a révélé aucun
  défaut caché, mais il rendait enfin possible
  `scripts/test-rien-de-recouvert-e2e.ts` : quatorze écrans, et sur chacun la
  question « qui répondrait au doigt ? » posée à chaque lien, bouton et champ.
  C'est la famille des trois seuls défauts que ce dépôt n'a jamais su attraper
  autrement qu'à l'œil. `ARCHITECTURE.md` §58.
- **Une seule forme d'action, et un contrôle qui la garde** (12 août) : la
  capsule est posée sur les dix-sept écrans du produit, et
  `scripts/test-boutons-arrondis.ts` refuse tout bouton rectangulaire ajouté
  ensuite — c'est le patron qui avait vu, sur la feuille d'envoi, un carré à
  côté d'une capsule. Les champs et les cartes gardent leurs 4 px : le rayon
  distingue ce qu'on touche de ce qu'on lit. `ARCHITECTURE.md` §67.
- **Le devis qui ne partait pas** (12 août) : le banc d'essai sert une version
  **bâtie**, donc `NODE_ENV=production` sans qu'aucun déploiement existe — et la
  seconde barrière du stockage, plus stricte que la première, refusait tout
  envoi. Une règle écrite deux fois qui avait divergé. `ARCHITECTURE.md` §66.
- **L'écran de connexion, dessiné mais PAS posé** (12 août) : le seul écran
  resté dans l'identité d'avant le 3 août, parce qu'il est le seul vu **avant**
  d'être connecté. `docs/maquettes/35-l-ecran-de-connexion.html` — l'avant, puis
  quatre après. **Son choix est attendu ; `src/app/login/` n'a pas bougé.**
  Trois corrections partiront quoi qu'il choisisse, dont les champs à 16 px, en
  dessous desquels iOS lui agrandit la page. `TODO.md` §0 nonies.

Ce qui **reste**, avec l'ordre, les valeurs, les sept pièges et les deux
réserves : **`TODO.md` §7**. Le dessin fait foi dans
`docs/maquettes/13-le-fil-quatre-couleurs.html`, qui est du HTML pur.

**Cinq pièces partagées portent toute la grammaire** — `EnTeteEcran`,
`PrimaryButton`, `src/lib/design-tokens.ts`, et depuis le 10 août au soir
`LigneRetirable` + `TiroirDesRetires` (avec le crochet `useRetraits`). Une allure ne se recopie pas dans
un écran : elle s'ajoute à ces pièces, sinon les écrans divergent de nouveau.
Les deux voix de l'écran retenu y sont depuis le 10 août : **`libelleCaps`**
(les libellés, états et actions secondaires) et **`texteSituation`** (ce qui se
lit sans se toucher). `smallCaps`, l'ancienne voix, ne sert plus qu'aux
maquettes `/design/*` — un écran qui l'importe encore n'est pas refait.

### Le banc d'essai (9 août 2026)

- **Il se relève seul.** `.devcontainer/veiller.sh` contrôle la santé toutes les
  quinze secondes et relance le serveur quand il tombe. Avant, un serveur mort
  le restait : le patron lisait « HTTP ERROR 404 », qui sur cette adresse veut
  dire « plus rien n'écoute ».
- **Il compile seize écrans d'avance.** `scripts/prechauffer.mjs`, au démarrage,
  avec une session fabriquée — jamais par le formulaire de connexion, dont le
  limiteur aurait verrouillé le patron au bout de cinq redémarrages. Jamais en
  production.
- **Deux serveurs ne se disputent plus le port.** `npm run essai` s'arrête si
  quelque chose répond déjà.
- **L'application est enfin constructible** sans les secrets de production
  (`ARCHITECTURE.md` §43), donc mesurable : démarrage 212 ms, écrans entre 50 et
  100 ms sur une machine à 4 cœurs.

### Mise en ligne

L'application-coque statique (`appli/`) est publiée sur GitHub Pages à
`https://florianmarrins0978-svg.github.io/Atlas-app/`. Le workflow `.github/workflows/pages.yml`
vérifie le site **à son adresse publique** après déploiement.

**Ce site n'est PAS le produit.** Ce sont cinq maquettes reprises d'Arborea —
Nouveau devis, Devis, Factures, TVA déductible, Mes tarifs — sans base ni
serveur, et qui portent encore le nom d'Arborea. Elles ne montrent ni les
chantiers, ni le planning, ni l'envoi au client, ni la facture, ni la TVA
collectée. Un bandeau le dit désormais en tête de chaque écran : le patron
lui-même s'y était trompé, ce qui était prévisible et entièrement de notre
faute.

L'application Next.js, elle, **n'est hébergée nulle part** — voir « Ce qui
bloque ». Mais elle est **essayable en entier dès maintenant**, y compris depuis
un téléphone, via l'espace de travail décrit dans
[`docs/ESSAYER.md`](docs/ESSAYER.md). Distinguer les deux importe : l'essai ne
demande aucune décision, aucun compte et aucun budget ; seule la mise en
production les demande.

---

## Les maquettes essayables : une seule adresse, et `appli/` en est la racine

**Ce qu'on lui donne, et rien d'autre :**
`https://florianmarrins0978-svg.github.io/Atlas-app/essais.html`

`.github/workflows/pages.yml` publie **`appli/` comme racine du site** — tout ce
qui y est déposé part en ligne, et rien d'autre du dépôt. `appli/essais.html`
est la page d'entrée : elle liste toutes les maquettes manipulables, chacune sur
un pavé d'au moins 64 px.

**Deux règles payées cher :**

- **Une adresse se donne entière, jamais avec des points de suspension.** Le
  18 août 2026 il a répondu : *« quand je fais pour cliquer, je ne peux pas
  cliquer »*. Un lien tronqué n'est pas un lien.
- **Toute maquette neuve s'inscrit à trois endroits, sans quoi elle n'existe
  pas :** `appli/essais.html` (le patron y arrive), la liste vérifiée après
  déploiement dans `pages.yml` (elle répond vraiment), et
  `npm run verifier:maquette` (elle tient ce qu'elle promet). C'est la même
  leçon que les huit planches introuvables trouvées par
  `scripts/fusionner-maquettes.mjs`.

## Le plan d'arrosage vit DANS l'application — 20 août 2026

**Où il est :** `/paysage/arrosage`. L'écran Paysage n'ouvre plus de page
extérieure.

| Le morceau | Le fichier |
|---|---|
| Le calcul | `src/lib/arrosage/calcul.js` et `catalogue.js` |
| La lecture du croquis | `src/server/ai/services/lire-croquis.ts` |
| Le geste | `src/app/paysage/arrosage/actions.ts` |
| L'écran | `src/app/paysage/arrosage/ArrosageClient.tsx` |
| D'où vient le débit | `src/lib/arrosage/mesure-debit.ts` |
| Qui sait lire une image | `etatVision`, dans `src/lib/etat-ia.ts` |

**LE CROQUIS DIT OÙ SONT LES CHOSES** (22 août 2026, soir). La lecture relève
les places en fraction du dessin (zones et nourrice) ; l'échelle se déduit des
cotes, et le trajet du regard à la première tête entre dans le calcul de
pression — 0,29 bar sur trente mètres. Sans nourrice dessinée, il n'est pas
compté et l'écran le dit. `geometrie-croquis.ts`, `ARCHITECTURE.md` §149.

**CE QUI ARRIVE AU DERNIER ARROSEUR EST CALCULÉ** (22 août 2026, soir). Le
dernier trou connu est fermé : l'électrovanne, la ligne (débit décroissant
tronçon par tronçon), ses raccords et l'antenne Ø16 sont retirés en plus de
l'amenée. Sur son jardin à 3 bar : **2,28 bar au dernier arroseur**, et les
buses sont dimensionnées là-dessus. Deux passes, jamais trois. **Reste dehors :**
le trajet du regard à la première tête, qu'aucune saisie ne donne — les deux
écrans le disent. Détail : `ARCHITECTURE.md` §147.

**LES BUSES SONT RAMENÉES À LA PRESSION DU CHANTIER** (22 août 2026). Le
catalogue ne donne qu'une valeur par buse, à une pression de référence : le
débit suit désormais `√(P/P_ref)` (physique de l'orifice, corrigé dans les deux
sens) et la portée `P^(1/3)` **vers le bas seulement** — l'exposant de la portée
est une estimation, et une portée réduite est signalée sous le plan. Son jardin
d'exemple à 3 bar passe de trois à quatre réseaux. Détail : `ARCHITECTURE.md`
§145. **Reste non fait :** les pertes du réseau lui-même (`TODO.md`).

**LE DIAMÈTRE DU TUYAU SE CALCULE, ET L'OUTIL DIT LE SEUIL** (22 août 2026).
Sa demande : *« passé un certain nombre de mètres linéaires, il faut passer du
PEHD Ø25 au Ø32 »*. Deux critères, `amenee()` dans `calcul.js` :

| | |
|---|---|
| **le débit** | vitesse ≤ 1,5 m/s → Ø25 : 1,76 m³/h · Ø32 : 2,91 |
| **la longueur** | Hazen-Williams retournée → le seuil en mètres |

L'écran de l'application affiche « Ø25 jusqu'à 55 m, Ø32 au-delà » ; la page
publiée `appli/arrosage.html` affiche en plus le verdict, parce qu'elle demande
la longueur. Éprouvé par `scripts/test-arrosage-calcul.ts`, et **la ligne de
l'écran de l'application n'a PAS pu être vue ici** : elle n'apparaît qu'un
croquis lu, ce qui demande une clé d'IA. Détail : `ARCHITECTURE.md` §144.

**LA LECTURE DU CROQUIS S'ÉPROUVE : `npm run verifier:croquis`** (21 août 2026).
Elle dessine un croquis dans un navigateur — deux surfaces aux cotes
différentes, une haie en mètres linéaires, un massif, un point d'eau —, le
photographie et vérifie que ce qui revient porte SES chiffres, pas des valeurs
par défaut. **À jouer depuis son espace**, où ses clés sont posées : ici et en
CI, elle refuse de rendre un vert et nomme ce qui manque. C'est la réserve que
`lire-croquis.ts` portait depuis sa naissance, et qui est levée.

**Et l'écran demande la BONNE question.** Il annonçait « aucune clé d'IA n'est
posée » dès qu'il ne voyait ni Anthropic ni OpenAI — faux dans les deux sens
depuis que `VISION_PROVIDER` sépare « qui rédige » de « qui regarde ». Deux
défauts corrigés le 21 août : `lireCroquis` appelait le fournisseur de
RÉDACTION, et le message n'accusait jamais le bon coupable.

**Ce que l'écran demande, et ce qu'il ne demande PAS.** Au compteur, rien : en
Ø25 juste après le compteur, on a au moins 3 bar en dynamique comme en statique,
*« tu sais d'office que tu es bien »* (20 août). Au robinet de jardin, **deux
encarts séparés** — sa correction du 21 août : la **mesure au seau** (10 L
chronométrés, marquée « trop approximatif pour calculer un arrosage : prenez
le kit ») puis le **kit débit /
pression, buse 5** (bar statique, bar dynamique). Le seuil retenu est **2,5 bar
en dynamique** — en dessous, les tuyères se lèvent mal et arrosent court.

**Pourquoi séparés, et pourquoi le seau s'excuse.** Deux gestes, deux outils,
deux fiabilités : sous un même titre, un chiffre tiré d'un seau rempli à la main
paraissait valoir celui d'un manomètre. Or c'est le seul des trois à donner le
débit, et le moins précis des trois.

**La statique n'est pas décorative.** C'est l'ÉCART entre les deux qui accuse :
une statique à 4 bar qui tombe à 2 en débit désigne une conduite trop maigre ou
trop longue. Le réseau se retaille, la pression ne se force pas. Et **la
pression ne donne jamais le débit** : deux robinets à 3 bar délivrent l'un
1 m³/h, l'autre 3. Sans seau, le débit est estimé **et le plan le dit**.

**AVANT DE TOUCHER AU CALCUL, LIRE CECI.** `src/lib/arrosage/calcul.js` est une
copie **octet pour octet** de `appli/arrosage-calcul.js`, et
`scripts/verifier-arrosage-une-seule-source.mjs` refuse qu'elles divergent. Une
correction se porte donc **des deux côtés**, jamais d'un seul. C'est le prix
payé pour n'avoir qu'un seul calcul : deux versions finiraient par ne plus dire
la même chose, et c'est le paysagiste qui verrait l'écart entre la page qu'il
essaie et l'application qu'il utilise (`CLAUDE.md` §3).

Conséquence assumée : la copie serveur porte des fonctions de navigateur que
rien n'appelle, et un silence de lint en tête du fichier l'explique.

**L'IA lit le croquis, et il fallait le vérifier plutôt que de l'affirmer.** Il
avait été dit ici que cela demandait un contrat inexistant — **c'était faux**.
Le raccordement Anthropic et OpenAI est écrit depuis le 6 août, les deux savent
regarder une image, et le patron a confirmé le 20 août que **les clés sont
posées**. Sans clé, l'écran le dit avant le geste au lieu de faire photographier
pour rien.

**Ce que la lecture rend, et ce qu'elle ne rend pas :** des surfaces, des
longueurs, un point d'eau — en **proposition**. Une zone sans cote ne part pas
au calcul, un croquis illisible est refusé avec sa raison, et ce qui n'a pas été
lu s'affiche en réserves sous le plan.

## Atlas fabrique TROIS documents en PDF

**Le troisième est né le 20 août 2026**, sur sa demande : *« fais en sorte que
les fiches chantiers soient au format PDF maintenant »*. Jusque-là il n'y en
avait que deux, et le vocabulaire du dépôt trompait.

| Le document | Où il vit | Ce qu'il porte |
|---|---|---|
| **Devis** | `src/server/pdf/devis-pdf.ts`, `/api/devis/[id]/pdf` | prix, totaux, TVA, **cadre de signature** |
| **Facture** | `facture-pdf.ts`, `/api/factures/[id]/pdf` | prix, totaux, TVA, mention légale, **pas de signature** |
| **Fiche de chantier** | `fiche-chantier-pdf.ts`, `/api/chantiers/[chantierId]/fiche/pdf` | ce qui a été fait, le matériel, les observations, les photos — **aucun prix** |

Les trois sortent du **même moteur** (`document-commun.ts`) : même papier, même
en-tête, même bloc client, même pied. **L'en-tête porte l'identité de
l'entreprise en entier — nom, adresse, téléphone, e-mail, SIRET, une ligne
chacun — et le bloc du bas ne nomme plus que le client** (25 août 2026,
`ARCHITECTURE.md` §174) : il était écrit deux fois, et c'est le patron qui l'a
vu. Trois moteurs auraient produit
trois mises en page qui divergent, et c'est le client qui verrait la différence
entre les feuilles d'un même artisan.

**Ce qui distingue la fiche : `sansChiffrage`.** Ni colonnes de prix, ni totaux,
ni TVA, ni IBAN, ni signature. Ce n'est pas une économie de place — c'est ce qui
la rend **transmissible** : on peut la donner à un locataire, à un syndic, à
l'assurance d'un voisin, sans divulguer ce que le propriétaire a payé.

**AVANT DE TOUCHER À `document-commun.ts`, LIRE CECI.** Le devis et la facture
sont les pièces que le client reçoit, et l'une est ce qu'il paie. Un `if` mal
placé y décalerait un total sans que personne le voie avant l'impression. Une
**empreinte de leur trace entière** — chaque texte, sa position au centième de
point, sa taille, sa couleur, sa page — est figée dans
`scripts/test-fiche-chantier-pdf.ts` et refuse le moindre écart. Elle a été
relevée avant la première ligne de `sansChiffrage`, et éprouvée rouge en
décalant le moteur d'un seul point.

**Trois mots proches désignent encore trois choses différentes :**

| Le mot | Ce que c'est |
|---|---|
| **fiche de chantier (PDF)** | le document ci-dessus, depuis le 20 août 2026 |
| **fiche chantier (écran)** | `src/app/chantiers/[id]/` — photos, note vocale, étapes |
| **fiche d'entretien** | un MODÈLE de prestations à cocher, un par entreprise (migration 0051) |

**Un piège de Next.js payé le 20 août :** la route a d'abord été écrite sous
`/api/chantiers/[id]/`, alors que le dossier voisin emploie `[chantierId]`.
Next.js refuse deux noms pour le même segment dynamique — et **le serveur entier
ne démarre plus**. Cinq écrans échouaient au préchauffage, et la suite accusait
un bouton introuvable trois écrans plus loin. Le message du serveur, lui, disait
juste : *« You cannot use different slug names for the same dynamic path »*.
Aller le lire a pris trente secondes ; le deviner aurait pris une heure.

## Le lecteur du patron n'exécute pas JavaScript — les maquettes doivent s'en passer

**Constaté le 2026-08-10, et payé une fois.** Trois bancs d'essai lui ont été
envoyés avec leurs barres d'onglets construites en JavaScript. Chez lui, ils
arrivaient **vides** : les textes s'affichaient, les téléphones étaient des
rectangles nus. La contrainte était déjà écrite dans son propre fichier de
maquettes — « son lecteur n'en exécute pas ; les pages engendrées en JavaScript
lui arrivaient vides » — et n'existait nulle part ici.

Ce que cela impose à **toute maquette qui lui est destinée** :

- **Aucune balise `<script>`, aucun gestionnaire en ligne.** Le contrôle est
  mécanique : chercher `<script`, ` on…=`, `javascript:` dans la source.
- **Ce qui doit réagir au doigt se fait en CSS.** Une barre d'onglets se bâtit
  avec quatre `input[type=radio]`, des `label`, et
  `input:nth-of-type(n):checked ~ .trait`. Les colonnes étant égales, un onglet
  vaut exactement `translateX(100%)` : rien à mesurer.
- **Un repère qui suit le défilement se fait avec `position: sticky`**, pas
  avec un calcul. Une pastille collée à `top: 50%` dans la liste **est**, par
  construction, sur l'élément centré ; avec `scroll-snap-align: center` sur
  chaque ligne, celui-ci vient se caler dessous. Rien à mesurer, et surtout
  rien qui puisse se désynchroniser du défilement — ce qu'un suivi image par
  image finit toujours par faire sur un téléphone chargé. Trois pièges,
  éprouvés le 2026-08-10 :
  - **Le point d'ancrage détermine la position au repos.** Placé en tête de
    liste, le repère est déjà au centre avant tout défilement ; placé dans le
    flux à hauteur d'une ligne précise, il s'y tient jusqu'à ce qu'elle
    remonte. C'est ce second placement que le patron demande.
  - **Le `50 %` se calcule sur la boîte de contenu de la zone de défilement.**
    Un rembourrage bas posé sur cette zone la rétrécit et décale le repère de
    la moitié — la marge de fin qui permet à la dernière ligne d'atteindre le
    centre doit donc être posée sur le **contenu**, jamais sur le conteneur.
  - **`scroll-snap-stop: always` a été RETIRÉ de l'application le 11 août 2026,
    et il ne faut pas le remettre.** Il tenait bien « un élément à la fois »
    dans la maquette, mais chez le patron il arrêtait le fil à chaque chantier
    et il l'a lu comme du saccadé — *« je trouve que ça manque de fluidité […]
    c'est saccadé »*. L'accroche reste, en `proximity` : la ligne se recentre,
    mais le geste ne se fait plus couper. Ce paragraphe décrit donc la maquette
    d'origine, pas le code d'aujourd'hui.
  - **L'accroche ne se vérifie pas à la molette synthétique.** Chromium sans
    interface ne l'applique pas : le contrôle rend la même valeur quelle que
    soit la correction. L'éprouver par un défilement programmé, auquel le
    moteur applique bien l'accroche.
- **Éprouver avec `javaScriptEnabled: false`.** Une page bâtie en JS passe tous
  les contrôles ordinaires et arrive quand même vide chez lui. Le contrôle
  ouvre la page dans ce mode, compte les onglets, et **charge en contre-épreuve
  une page bâtie en JS pour vérifier qu'il y en trouve zéro** — sans quoi il ne
  prouverait rien. Aucun script du dépôt ne le fait à ce jour : il vit dans
  l'espace de travail de la conversation, et devra être rapatrié ici le jour où
  des maquettes seront produites depuis le dépôt.

Cela ne concerne pas l'application elle-même, qui est un Next.js qu'il ouvre
dans Safari. Uniquement ce qu'on lui **transmet à lire**.

---

## Une identité visuelle est en cours de remplacement — ne pas se fier au code seul

**Constaté le 2026-08-10, hors du dépôt**, puis précisé en lisant ses maquettes.
Le patron explore une identité que rien ici ne mentionne. Elle est engendrée de
son côté par un script nommé `engendrer-maquette-fil.mjs`, **absent du dépôt**,
et ses pages portent la consigne « ne pas les modifier à la main ».

**Quatre chartes**, pas une, et l'accent n'est jamais le vert pin d'Arborea :

| Charte | Fond | Encre | Accent |
|---|---|---|---|
| Origine | `#edece6` | `#16170f` | `#8f7130` |
| Ivoire | `#efece6` | `#221f1a` | `#8a7452` |
| Sylve (sombre) | `#16241c` | `#e6e6da` | `#c3b184` |
| Océan | `#e6ecf2` | `#0d1b2c` | `#1e4f86` |

**Trois formes de liste** sont mises en concurrence : *le fil* (une tige
verticale porte les jours, une seule perle sur ce qui attend une réponse),
*l'ourlet* (un cheveu vertical qui prend la couleur d'attente là où un geste est
dû), *la plage amincie*.

Ce que cela change pour le code, et pourquoi c'est écrit ici :

- **La navigation basse perd ses icônes.** Quatre libellés en petites capitales
  — 9,5 px, `letter-spacing: .28em`, graisse 500 — en grille de quatre colonnes
  égales. L'onglet actif prend la couleur d'encre et **un trait d'un pixel sur
  toute la largeur de sa colonne** (`box-shadow: inset 0 -1px 0`), pas sous le
  seul mot. `AtlasBottomNav` code aujourd'hui l'inverse : icône + libellé,
  accent porté par la couleur du texte.
- **Deux refus explicites, à ne pas défaire :** aucun cheveu sous « ATLAS » —
  seul reste celui qui ferme l'en-tête, au-dessus de « Nouveau chantier » ; et
  la couleur ne décore pas, elle ne se pose que là où un geste est attendu.
- `src/lib/design-tokens.ts` et `docs/DESIGN_SYSTEM.md` décrivent donc une
  identité que le patron est en train de quitter.

### Ce que le patron a arrêté le 2026-08-10, sur maquettes

Cinq choix faits, après avoir touché chaque variante sur son téléphone :

| | Retenu | Ce que ça veut dire |
|---|---|---|
| Charte | **Origine** | fond `#edece6`, encre `#16170f`, bronze `#8f7130` |
| Trait du bandeau | **G** | il dépasse sa cible et revient ; le mot choisi monte de 2 px, le mot quitté redescend |
| La perle du fil | **elle suit** | posée devant le 22 juillet au repos, accrochée à mi-hauteur dès que ce chantier remonte, **un chantier par glissement** |
| « Nouveau chantier » | **l'écran recule** | la liste passe à 93 % et s'assombrit, la feuille monte devant, son contenu arrive après elle dans l'ordre de lecture |
| Retirer un chantier | **le tiroir des retirés** (P) | on fait glisser **le texte** de la ligne vers la gauche, « Retirer » se découvre ; la ligne **tombe** et un tiroir s'ouvre au-dessus du bandeau : « Retiré à l'instant — Annuler » |

**Ce que le retrait retenu suppose.** Le geste n'efface pas : il déplace vers
un état réversible tant qu'on est sur l'écran. Trois règles en découlent, et
elles ont été payées à l'essai sur la maquette :

- **La date et le fil ne glissent pas avec le texte.** Faire partir la ligne
  d'un bloc coupe le nom en plein mot et laisse le fil traverser les lettres :
  ça se lit comme un défaut d'affichage, pas comme un geste. Seule la colonne
  du texte bouge, et un voile de 16 px la fait se **dissoudre** au bord plutôt
  que d'être tranchée. La marge négative du glisseur et le retrait intérieur du
  volet s'annulent, sinon la première lettre est mangée **au repos**.
- **« Annuler » doit viser la ligne réellement retirée.** Un libellé unique
  pointant toujours la même case rend la première ligne quand on retire la
  deuxième — l'annulation *supprime*. Chaque ligne porte son libellé, et on
  n'affiche que celui du dernier retrait, détecté par
  `:has(#cN:checked ~ .sup:checked)`.
- **Le décompte suit ce qui reste.** « Huit en cours » au-dessus de six lignes
  est le genre de détail qui décide seul du sentiment de soin. Sans script, une
  chaîne de `~ .sup:checked` compte les cases cochées.

**Réserve :** le tiroir et le décompte reposent sur `:has()`. S'il manque, la
ligne part quand même mais le tiroir ne s'ouvre pas — dégradation acceptable,
à confirmer sur l'iPhone du patron. Dans l'application, le tiroir devra porter
un délai réel avant l'écriture en base ; la maquette, elle, ne fait que cacher.

**Aucun chantier facturé n'apparaît sur cet écran** — ils vivent sous
« Terminés ». Le refus (« sa facture figure au relevé de TVA ») se joue donc
là-bas, et c'est là qu'il faudra l'écrire.

**Conséquence assumée sur la perle**, signalée deux fois et maintenue : elle ne
désigne plus le chantier dont le devis est revenu, puisqu'elle suit le doigt.
Seul reste le libellé « Devis retourné », en bronze. Ne pas « corriger » cela
par erreur en croyant retrouver l'intention d'origine.

**Réserve non levée :** « Nouveau chantier » est aujourd'hui une **page**
(`/chantiers/nouveau`, avec sa flèche de retour vers la liste), pas une
feuille modale. L'ouverture retenue raconte une feuille. Soit l'écran devient
une vraie feuille — et la flèche cède la place à un geste de fermeture vers le
bas —, soit l'ouverture devra changer le jour de l'intégration. Le patron a
tranché sur le style ; ce point de produit reste ouvert.

### Le planning, et les équipes nommées — 2026-08-10

Deux écrans de plus ont été arrêtés le même jour, sur maquettes :
`maquettes/atlas-planning.html` (le mois, les demi-journées, les équipes) et
`maquettes/atlas-equipes.html` (Réglages : nommer les équipes). Les deux sont
tenus par `npm run verifier:maquette` ; la spécification d'intégration est dans
`docs/INTEGRER-ORIGINE.md` §6 ter, la suite technique dans `TODO.md` §5.

**La règle du nommage, qui n'est pas un détail d'affichage** — elle vient d'une
demande explicite du patron : *« s'il n'a pas d'équipe et qu'il ne met rien, il
ne faut pas qu'il y ait quand même écrit équipe A équipe B »*.

- **À une équipe**, le planning n'écrit **aucun nom d'équipe** : une
  demi-journée est libre, ou elle porte le nom de son chantier. Réglages ne
  propose même pas de la nommer — offrir un champ dont la valeur ne sera jamais
  lue est un piège.
- **À deux et plus**, chaque équipe a sa ligne dans Réglages. Le champ vide
  affiche déjà « Équipe A » en gris : le repli est **montré** avant d'être subi.

Le principe qui tient les deux cas : **on n'invente jamais un nom, et on ne
laisse jamais deux lignes indiscernables.** Conséquence pour la base :
`equipes.nom` sera **nullable** — un nom absent est un état normal, pas une
donnée manquante — et **une seule fonction pure** décidera du libellé, pour le
planning comme pour la revalidation.

**Rien d'autre n'est tranché, et rien n'a été codé dans ce sens.** Mais une conversation
qui lirait le dépôt seul repartirait en vert pin avec des icônes, c'est-à-dire à
contresens. Quand le choix sera arrêté, ce sont `design-tokens.ts`,
`globals.css`, `manifest.json`, `AtlasBottomNav` et `docs/DESIGN_SYSTEM.md` qui
changent ensemble — les cinq, sinon deux chartes coexisteront comme en juillet.

---

## Ce qui reste, et que je peux faire seul

Voir `TODO.md` pour le détail et l'ordre.

- **Les clients ont enfin une porte — FAIT le 17 août au soir.** Sa remarque :
  *« la catégorie client n'a pas été créée »*. La fiche existait depuis la
  veille mais ne s'atteignait que depuis un chantier ; la **liste** s'ouvre
  maintenant depuis l'accueil (« Vos clients »), avec pour chacun ses chantiers,
  ce qui a été facturé et ce qui reste dû. **Pas de cinquième onglet** : il est
  réservé aux outils métier (`ARCHITECTURE.md` §125).

- **Le catalogue s'écrit — FAIT le 17 août** (`ARCHITECTURE.md` §122, migration
  0052). Il a posé deux fois la même question sur cet écran : *« À quoi sert
  cette page ?? On peut rien modifier rajouter »*. Ses mots s'accrochent
  désormais aux entrées d'Atlas (arrangement B de la planche 72), le catalogue
  partagé reste intouché, et **un mot ajouté est reconnu par la dictée** — les
  quatre chemins de recherche passent par la même fonction. Réparés au passage :
  la flèche de retour, et « aucun prix encore constaté », une phrase qui lisait
  une mémoire jamais écrite et ne se serait jamais éteinte. **Et Atlas PROPOSE
  désormais de retenir les mots qu'il entend** quand il sait à quoi ils se
  rapportent (migration 0053) : deux boutons, le « non » retenu pour toujours,
  et jamais rien dans le vocabulaire commun. **Une décision reste à lui**
  (`TODO.md` §0 octovicies bis) : faut-il remettre un prix sur ces cartes, alors
  que la mémoire des prix range par nature de chantier et non par mot.

- **Les réglages, dix rubriques** — **toutes dessinées, la première est codée**
  (`ARCHITECTURE.md` §94) : `/reglages/identite` existe, et le **régime de TVA
  se déclare au lieu d'être deviné d'après le taux**. **Le sommaire lui-même est CODÉ le
  14 août** (`ARCHITECTURE.md` §96), d'après une planche que le patron a envoyée
  de lui-même : dix rubriques, une icône chacune, « Devis & factures » et
  « Planning », en filets et dans la charte — sa planche était sombre, il a
  tranché « crème, comme le reste ». **Tout ce qui s'empilait sur l'écran est
  parti dans sa rubrique** : tarifs, grilles de prix et catalogue ensemble ;
  périodicité de TVA auprès du régime ; équipes du planning dans « Planning » ;
  vocabulaire sous « Atlas IA » ; données sous « Sécurité & données ». La
  version exécutée reste sur le sommaire, parce qu'une capture doit y répondre.
  **C'est aussi le premier écran d'Atlas où `getRole` décide de ce qui est
  RENDU** : un membre ne reçoit que l'ensemble « Moi », et chaque rubrique de
  l'entreprise refuse un non-propriétaire avant de lire une valeur. Le reste de
  l'application, lui, ne cloisonne toujours rien. **Les TREIZE rubriques sont
  ouvertes au 14 août 2026** — plus aucune ne porte « Bientôt »
  (`ARCHITECTURE.md` §108). Deux d'entre elles ne règlent rien et l'assument :
  *Abonnement* (ni prix ni offre décidés). **Apparence, elle, règle désormais
  les SEPT CHARTES DE COULEURS** — Origine, Pierre, Beurre, Moka, Prune, Sylve,
  Nuit, dont deux sombres (`ARCHITECTURE.md` §114). Elles repeignent toute
  l'application ; les devis et factures gardent l'identité d'Atlas. Par défaut,
  rien ne change : « Origine » reprend les valeurs d'avant au caractère près. *Notifications*,
  elle, porte **quatre rappels réels** qui apparaissent sur l'accueil — chantier
  sans devis, devis sans réponse, chantier fini non facturé, **facture impayée**.
  Ce dernier est arrivé le 16 août avec la donnée qui lui manquait — le paiement,
  noté depuis « Terminés › TVA » —, et c'est le seul qui porte un **rythme**
  (`ARCHITECTURE.md` §118). Les deux dernières ouvertes sont
  **« Mon compte »** et **« Connexion »** (`ARCHITECTURE.md` §107) : changer son
  nom, changer son mot de passe, et **« me déconnecter partout »** — une colonne
  plutôt qu'une table de sessions. Leurs libellés promettaient un *téléphone* et
  une liste d'*appareils* qui n'existent nulle part ; le patron a tranché « A A »
  le 14 août, les deux mots sont retirés. **L'e-mail ne se change pas encore**,
  et l'écran le dit : rien ne permettrait de vérifier une nouvelle adresse, et
  une faute de frappe fermerait le compte sans recours. Ce qui suit décrit l'état
  d'avant ce lot, et reste vrai pour les neuf autres rubriques : (`maquettes/atlas-reglages-plan.html`, `ARCHITECTURE.md` §86). Ce qui
  y est tranché : les deux niveaux « Moi » / « Mon entreprise », qui voit quoi,
  et ce qui n'aura jamais d'interrupteur. Ce qui ne l'est pas : le rôle
  **commercial** n'existe ni en base (`membres_entreprise.role` : propriétaire
  ou membre) ni dans les décisions écrites, et **le cloisonnement par rôle n'est
  pas codé** — un écran qui n'affiche pas une rubrique ne protège rien
  (`docs/QUESTIONS.md` §10). L'ordre des lots est dans `TODO.md` §0 quatervicies.
  **Lot 2 dessiné le 13 août** (l'identité) : il a révélé que le **régime de TVA
  est deviné d'après le taux appliqué** — donc faux dans les deux sens sur une
  pièce comptable —, que le **numéro de TVA intracommunautaire n'existe nulle
  part**, et que le **téléphone et l'e-mail ne s'impriment sur aucun document**
  (`ARCHITECTURE.md` §87). **Et surtout : le premier jour d'un artisan n'a
  jamais été vu.** Le jeu de départ pose une entreprise complète, il n'existe
  aucun parcours d'inscription, l'identité ne se saisit que dans le devis écrit
  à la main, et **rien ne la vérifie avant l'envoi** — le premier devis d'un vrai
  artisan part sans SIRET ni IBAN. Un blocage a été codé le 14 août puis
  **retiré le même jour à sa demande** : *« rien de plus, rien de moins »*
  (`ARCHITECTURE.md` §97). Ce n'est donc pas un oubli, c'est un risque qu'il
  assume. **Restent bloquants pour la commercialisation** : aucun écran ne
  permet de créer son entreprise, le jeu de départ en pose une déjà remplie, et
  le nom manquant s'écrit encore « Votre entreprise » au lieu d'être signalé
  (`docs/A-FAIRE.md` §10).
  **Lot 3 dessiné le 13 août** (l'équipe) : « équipe » désigne déjà une file du
  planning et non un compte — deux listes séparées —, et le **cloisonnement en
  lecture n'existe pas** : `getRole` n'est appelé dans aucun écran, un membre
  voit aujourd'hui tous les montants (`ARCHITECTURE.md` §88). **Lot 4 dessiné le
  13 août** (tarifs) : **les quatre priorités du patron sont dessinées**. Restent
  à coder la colonne de famille sur `tarifs`, le signalement d'une unité
  manquante, et le nombre de prix appris par grille (`ARCHITECTURE.md` §89).
  **L'unité, elle, est codée le 14 août** : elle se choisit dans un bandeau
  déroulant, sans se refermer sur une liste (`ARCHITECTURE.md` §101). **Et les
  tranches des grilles se règlent depuis le 14 août** : elles ne sont plus
  écrites dans le code (`ARCHITECTURE.md` §105).
  **Et surtout : `parametres_chiffrage` — cinq valeurs qui décident du prix
  proposé — n'a aucun écran.** Un artisan dont l'ouvrier coûte 260 €/jour verra
  des prix trop bas sans savoir d'où ils viennent.

- **Agenda Google** — la connexion du compte demande des identifiants que je n'ai
  pas ; le reste (lecture des disponibilités, écriture de l'intervention) est
  codable.
- **Agenda iCloud** — demandé le 12 août 2026 **dans les deux sens**, et
  **codé le jour même** : lecture des créneaux occupés, écriture des chantiers,
  retrait au débranchement (`ARCHITECTURE.md` §75). Ce qui **reste** : aucun
  échange réel avec iCloud n'a eu lieu — le réseau d'ici refuse
  `caldav.icloud.com`. Les trois appels HTTP ne seront éprouvés que sur son banc,
  avec un vrai mot de passe pour les apps. Tout ce qui décide, lui, est couvert
  ici. Ne pas l'annoncer vérifié avant.
- **Code SMS en renfort de l'acceptation** — l'empreinte, l'horodatage et
  l'adresse sont déjà conservés. **Sans objet en l'état**, pour la même raison.
- **Relance automatique** — l'état « à relancer » existe et s'affiche, le lien
  reste proposé pour un renvoi. **Sans objet en l'état** : aucun fournisseur
  d'envoi ne sera branché (`ARCHITECTURE.md` §13), la relance part de la
  messagerie du patron comme l'envoi.

---

## L'application est jugée trop chargée — mesuré, pas encore tranché (19 août)

**Sa plainte, la troisième** (11, 17 puis 19 août) : *« beaucoup trop de mots
dans tous les sens »*. Trois écrans ont été regardés à la taille de son
téléphone et leurs mots comptés :

| Écran | Aujourd'hui | Proposé |
|---|---|---|
| Fiche client | 39 mots | 19 |
| Accueil | 35 mots | 21 |
| Réglages | 89 mots | 26 |

**Proposé, pas codé** — `appli/moins-de-mots.html` est **Atlas dépouillé et
utilisable** : la barre du bas marche, « Créer un devis » ouvre la fiche, les
champs se remplissent, le devis part ; un bouton « Avant » remet l'écran
d'aujourd'hui. Sans JavaScript. Liée depuis `appli/essais.html` — la seule
adresse qu'il puisse ouvrir. Et `docs/QUESTIONS.md` §23. **Rien dans `src/`**
tant qu'il n'a pas choisi (`CLAUDE.md` §3 bis).

Ce qui compte le plus n'est pas les trois écrans : c'est que **rien n'empêche
l'application de regrossir**. Les deux fois précédentes, un écran a été corrigé
et la gêne est revenue ailleurs.

## Ce qui bloque, et qui n'avancera pas en codant

**Cinq** points, tous dans **`docs/A-FAIRE.md`**, tous en attente d'une
décision du patron. Celui du fournisseur d'envoi a été tranché le
2026-08-04 : il n'y en aura pas, et il est laissé barré ci-dessous pour éviter
qu'on le rouvre.

1. Choisir les deux fournisseurs d'IA définitifs (transcription, raisonnement).
   **Ce point a un effet visible tous les jours** : sans modèle, la dictée est
   seulement *recopiée*, jamais comprise. La recopie ne perd plus rien (voir
   `scripts/test-analyse-dictee.ts`) et elle mène désormais jusqu'au devis
   chiffré, mais elle ne sait pas qu'un chêne mort s'abat et qu'une haie se
   taille — et l'écran l'annonce plutôt que de la faire passer pour une analyse.
2. Faire rédiger le contrat de sous-traitance par un juriste.
3. Choisir un hébergement européen — **sans lui, personne d'autre que le patron
   ne peut se servir de l'application**. N'empêche NI d'essayer NI de finir le
   produit : voir `docs/ESSAYER.md`. La marche à suivre, les fournisseurs
   candidats et le partage des tâches sont détaillés dans `docs/A-FAIRE.md` §3.
4. Constituer une société et souscrire une assurance cyber.
5. ~~Brancher un fournisseur SMS et e-mail~~ — **tranché le 2026-08-04 : il n'y
   en aura pas** (`ARCHITECTURE.md` §13). Le patron ouvre lui-même sa
   messagerie, message et destinataire déjà remplis, et appuie sur envoyer.
   Ce point ne bloque donc plus, et il **allège** les points 2 et 3 : aucune
   donnée de client ne transitant chez un tiers, il n'y a aucun sous-traitant de
   plus à autoriser. Restent hors de portée, en conforts et non en blocages :
   relance automatique à sept jours, départ automatique de la facture, accusé de
   réception, code SMS à l'acceptation.
6. Choisir l'outil comptable qui **émet** les factures — le patron n'en a aucun
   à ce jour (8 août 2026). Ne pas confondre avec la réserve ci-dessous : que
   Atlas n'émette pas est **définitif** ; ce qui est ouvert, c'est seulement sur
   quoi se brancher. Chaque outil ayant son API, il n'y a rien à coder avant le
   choix. Deux obligations distinctes en dépendent — la conformité des factures
   des artisans à qui Atlas sera vendu, et celle d'Eden Nature pour ses propres
   factures, qu'Atlas existe ou non.

---

## Le terrain n'est pas vierge : deux concurrents directs

Découverts le 2026-08-03 **en cherchant un nom** — pas au cours d'une étude de
marché. C'est écrit ici parce qu'une conversation qui l'ignore raisonnerait
comme si le créneau était libre, et il ne l'est pas.

| Concurrent | Ce qu'il a pris | Ce qu'on en apprend |
|---|---|---|
| [`ouvra.app`](https://ouvra.app/) — SAS Automate, Paris | **Un métier** : plombiers-chauffagistes uniquement. Devis signé sur place, Factur-X 2026, relances automatiques. Catalogue de prestations pré-rempli, TVA du secteur. | Se restreindre à un métier permet de livrer un catalogue et des mentions légales *déjà justes*. C'est exactement ce que notre §3 d'`AGENT.md` refuse de deviner. |
| [`fabro.app`](https://fabro.app/en/) — app iOS artisans | **L'absence de réseau** : 100 % hors ligne, données sur le téléphone, multi-pays. | Sur un chantier, il n'y a pas de réseau. Notre parcours suppose l'inverse à chaque étape. |

**Notre angle reste distinct** : ni l'un ni l'autre ne part de la **dictée** ni
ne fait travailler un **agent** entre la note vocale et la facture. Ils
numérisent un formulaire ; nous supprimons le formulaire. Mais l'angle n'est
plus une évidence à ne pas défendre.

## Le nom « Atlas » est provisoire, et probablement indéposable

« Atlas » n'a jamais été choisi ni vérifié : c'est un nom de travail. Le mot est
massivement occupé dans les classes 9 et 42, ce qui rend le dépôt de marque et
la visibilité App Store douteux. **Un nom définitif est en cours d'arbitrage
avec le patron** (branche `claude/app-name-choice-hk5jz4`) ; rien n'est renommé
tant qu'il n'a pas tranché.

Onze candidats ont déjà été écartés sur occupation vérifiée — Silex, Ouvra,
Vulcain, Sève, Orme, Fabro, Amadou, Braise (voisin de Braze), entre autres. La
leçon vaut pour les suivants : **vérifier l'occupation avant de proposer**, un
mot ordinaire libre en classes 9/42 est devenu l'exception.

---

## Réserves assumées, à ne pas « corriger » par erreur

- **Atlas prépare, il n'émet pas.** La facture et le relevé de TVA sont
  préparés ; l'émission légale et la déclaration reviennent à l'outil comptable
  (`docs/AGENT.md` §6). Ce n'est pas « pas encore » : c'est définitif, et la
  réserve est affichée à l'écran du relevé.
- **Le dépôt est public**, décision du patron du 2026-08-01. `docs/RGPD.md` y
  compris. Voir `docs/QUESTIONS.md` §6 et §7.
- **La signature des commits est impossible** dans l'environnement d'exécution :
  la clé SSH configurée est un fichier vide sans partie privée. Signalé une fois,
  non contourné.
- **Une réponse à l'arrêt d'avant-chiffrage ne change pas encore le montant.**
  Ce n'est pas un oubli : `docs/EXEMPLE-DICTEE.md` §9c l'exige tant qu'aucun
  rapport n'a été observé entre les techniques et les prix. Ce qui manque est la
  mémoire (`TODO.md` §0 bis a et c), pas la question.
- **La sauvegarde *automatique* n'existe pas, et c'est un blocage réel** — pas
  un oubli. Elle exige une destination extérieure, donc l'hébergeur (point 3
  ci-dessus). Le bouton « Télécharger mes données » couvre l'essentiel en
  attendant. Voir `ARCHITECTURE.md` §25 et `TODO.md` §0.

---

## Éprouver ici : PostgreSQL et Redis tournent, sans Docker

**Corrigé le 2026-08-05, contre ce que le dépôt affirmait.** Docker manque bien,
mais les binaires PostgreSQL 16 et `redis-server` sont installés dans
l'environnement d'exécution de l'agent. Une commande monte le tout :

```bash
source scripts/monter-base-locale.sh   # cluster, rôles, Redis, migrations
npm test
```

La croyance inverse coûtait cher : « c'est la CI qui vérifiera » a été dit trois
fois alors que la CI n'avait jamais tourné, et les suites base n'étaient donc
éprouvées nulle part. **Cela ne remplace pas la CI** — le mandataire réseau et
l'absence de Docker restent réels pour le reste (voir `ARCHITECTURE.md` §15
et §17).

---

## Ce qu'il peut régler sur ses documents — 23 et 24 août 2026

Deux réglages neufs, tous deux dans **Réglages › Devis & factures**, tous deux
demandés par lui et tranchés sur planche.

| | Ce qu'il règle | Ce qui ne se règle pas |
|---|---|---|
| **Son message au client** | le texte qui part avec le devis, la facture et le compte rendu | l'objet du courriel, et le **lien** — Atlas refuse un message sans lui |
| **L'allure de ses devis** | dix typographies, le fond, l'accent, son logo | la feuille de chantier et le compte rendu, qui gardent leur allure (sa décision) |

**Le défaut est, dans les deux cas, ce que ses documents portaient déjà.** Rien
ne change tant qu'il n'y touche pas — et cela se vérifie, pas seulement se dit :
`test-allure-pdf.ts` compare deux devis octet pour octet.

`ARCHITECTURE.md` §161 et §164.

## Le capital social et le RCS s'impriment, s'il le veut — 30 août 2026

Trois mentions légales de société, réglées dans **Réglages › Identité** :
forme juridique (existait, jamais imprimée nulle part avant ce lot), capital
social et ville d'immatriculation au RCS (les deux neufs). Un seul réglage,
**« sous le nom » / « en bas, avec le SIRET » / « ne pas les imprimer »**,
gouverne les trois ensemble — défaut « ne pas les imprimer », pour ne
surprendre personne qui avait déjà saisi une forme juridique sans savoir
qu'elle ne s'imprimait pas. Le RCS ne redemande pas de numéro : c'est le
SIREN, déjà affiché sous le SIRET. Les deux champs neufs disparaissent pour
une EI ou une micro-entreprise (`formeADuCapital`, `src/lib/formes-juridiques.ts`).

**Trois défauts réels du dépôt, trouvés en construisant** : `formeConnue` ne
reconnaissait jamais « Micro-entreprise » (le tiret n'était retiré que d'un
côté de la comparaison) ; la forme juridique ne s'enregistrait JAMAIS depuis
la liste déroulante, une fermeture React périmée dans `ChampFormeJuridique`
existant depuis le 14 août ; et `enEuros` faisait planter tout PDF portant un
montant à quatre chiffres (l'espace fine de `Intl.NumberFormat`, que
l'encodage des polices PDF ne connaît pas). Les trois sont corrigés. Détail
dans `CHANGELOG.md` du jour et `ARCHITECTURE.md` §213.

## Vérifications au dernier point

| | |
|---|---|
| Suites base de données | **99/99**, jouées dans l'environnement de l'agent |
| Suites navigateur (bout en bout) | **44/44**, jouées dans l'environnement de l'agent |
| Types, lint | propres |
| CI GitHub | verte au commit `78c746a` ; `07fa28c` en cours au moment d'écrire |
