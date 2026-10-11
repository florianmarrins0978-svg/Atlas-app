# Libérer une demi-journée, et la reposer ailleurs

**10 septembre 2026.** Votre planche `liberer-une-demi-journee.html`, essayée
puis retenue : *« La planche 1 est bonne tu peux la coder »*. Ce document dit ce
qui est fait, ce qui a été corrigé en cours de route, ce qui a été mesuré, et ce
qui reste ouvert.

---

## Ce que vous avez demandé, et ce qui est codé

| Votre demande | Ce qui est fait |
|---|---|
| *« Quand je clique sur déplacer, le bouton matin/aprem apparaît mais les deux sont vides, blancs »* | l'interrupteur s'ouvre **éteint des deux côtés** — il pose une question, il ne décrit pas un état |
| *« Je clique sur le matin, il devient vert et le matin du vendredi devient libre »* | la demi-journée sort du chantier ; la journée se rouvre, pastille comprise |
| *« Une demi-journée de Mr Julien sort »* | elle attend dans le tiroir du bas, sous « Sans date » |
| *« À la place on ajoute un chantier comme d'habitude »* | le moment libéré reçoit n'importe quel autre chantier, par le geste habituel |
| *« La demi-journée retirée peut être replacée »* | on la touche en bas, puis on touche la demi-journée qui l'accueille — deux gestes, comme poser un chantier |

**Seules les demi-journées que le chantier occupe CE jour-là sont offertes.** Un
chantier qui n'a que le matin n'a pas d'après-midi à rendre.

---

## Ce que ça a demandé sous le capot, et pourquoi c'était inévitable

Un chantier posé se décrivait par trois nombres : un jour, un moment de départ,
une durée. Trois nombres qui ne savent dire qu'**un bloc d'un seul tenant** —
aucun endroit où écrire « le matin est rendu, l'après-midi tient ».

C'est d'ailleurs ce qui produisait votre question de la veille : *« quand je
clique sur déplacer l'aprem, c'est le 15 et le 11 qui bougent »*. Le bouton ne
pouvait que faire glisser le bloc entier.

Le chantier porte désormais **où chacune de ses demi-journées est posée**.

| | |
|---|---|
| ce que le chantier **demande** | la durée vendue au devis — elle ne bouge pas |
| où il est **posé** | demi-journée par demi-journée |
| l'écart entre les deux | ce qui **attend une place**, en bas |

**Rien n'a été recopié pour vos chantiers déjà posés, et c'est voulu** : un
chantier sans détail garde son bloc calculé. Faire l'inverse — lire « aucun
détail » comme « rien d'occupé » — aurait libéré d'un coup toutes vos
demi-journées déjà prises, et l'écran d'envoi aurait proposé à un client un jour
où quelqu'un travaille.

---

## Trois défauts trouvés en REGARDANT l'écran, pas en lançant des contrôles

Les trois étaient verts en tests. Ils sont corrigés, et à la racine.

| Ce qu'on lisait | Ce qui n'allait pas |
|---|---|
| le **lendemain** se noircissait au calendrier | l'écran recalculait le bloc au lieu de lire où le chantier est posé : une journée qui repart de l'après-midi débordait sur le matin suivant |
| « une journée » sous le nom, « ½ journée à poser » en bas | ça faisait une journée et demie pour un chantier d'un jour. La carte annonce désormais ce que le chantier **occupe**, comme votre planche le compte |
| le tiroir du bas restait **fermé** | il ne s'ouvrait que pour « Sans date » et « En attente du client ». Une demi-journée rendue toute seule n'apparaissait donc **nulle part** — le geste marchait, et rien ne permettait de le finir |

Le troisième aurait rendu votre demande inutilisable le jour où vous n'auriez
rien d'autre en attente. Il a été trouvé par la suite qui rejoue votre geste en
entier, et non par les contrôles écrits autour du code.

---

## Le défaut le plus cher, et il ne venait pas de vous

**La date que votre client accepte ne posait pas le chantier au bon endroit.**

Quand un client retient une date, Atlas planifie le chantier tout seul. Cette
partie-là écrivait le jour sans écrire le détail des demi-journées : un chantier
déjà posé ailleurs y restait affiché, et la date choisie par le client
n'apparaissait **nulle part** sur votre planning.

Trouvé en cherchant pourquoi une suite rougissait, corrigé à la racine — les
deux chemins qui posent un chantier passent désormais par la même porte — et
tenu par un contrôle que j'ai vu rougir contre l'ancien code : *« le chantier
occupe encore le 5 mars au lieu du 10 mars choisi par le client »*.

---

## Ce qui a été supprimé

`deplacerChantierAction` — l'ancien « Déplacer » du planning. Plus personne ne
l'appelait une fois le nouveau geste en place, et un code mort se lit encore :
la prochaine correction pourrait y être faite pour rien.

La fonction reste employée à un seul endroit, l'assistant : quand vous dites
« mets Mr. Julien l'après-midi », c'est elle qui répond.

---

## Ce qui a été mesuré

| | |
|---|---|
| types, lint, mémoire | **verts** |
| pansement, code mort, couches, flèches | **verts** |
| les règles de la pose demi-journée par demi-journée (12 cas) | **verts** |
| **votre geste, du début à la fin, dans un navigateur** (8 cas) | **verts** |
| la batterie complète | *voir plus bas* |

Le contrôle de votre geste part du planning, pose un chantier d'une journée,
rend son matin, le retrouve en bas, et le repose sur un autre jour — en
vérifiant la base après chaque appui, parce que l'écran repeint avant que le
serveur ait répondu.

---

## Ce qui reste ouvert

**« Déplacer » n'a pas d'« Annuler ».** Une fois l'interrupteur ouvert, il n'y a
pas de geste pour refermer sans choisir : on sort en fermant la journée. Votre
planche n'en montrait pas, donc rien n'a été ajouté de mon propre chef — et
libérer se défait de toute façon, puisque le morceau se repose. **Dites-moi si
vous le voulez.**

**Poser un chantier en deux morceaux d'un seul geste** n'existe toujours pas :
il faut le poser entier, puis rendre ce qui ne va pas. Suffisant pour ce que
vous décriviez ; à rouvrir si ça vous gêne.

---

**Pour voir le changement dans l'application**, votre espace doit redémarrer :
l'écran **Réglages** dit quelle version est servie.
