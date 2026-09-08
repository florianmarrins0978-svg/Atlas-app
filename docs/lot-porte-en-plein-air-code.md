# La porte en plein air — codée

**8 septembre 2026.** Votre demande : *« code-moi exactement la deuxième maquette
avec les questions ! J'en avais supprimé deux il me semble ! »*

Les deux retraits sont les bons : **l'accroche sous ATLAS** et **le sceau à
l'étoile**. Ni l'un ni l'autre n'est dans ce qui a été codé, et un contrôle les
empêche de revenir.

---

## Ce qui existe maintenant, et où

| | |
|---|---|
| **`/bienvenue`** | la porte : la photo, ATLAS, la phrase des conditions, « Créer un compte », « Se connecter ». C'est là qu'arrive quelqu'un qui n'a pas de compte |
| **`/creer-un-compte`** | **une question à la fois**, seize au plus. Elle crée votre compte ET votre entreprise, et **vous fait entrer directement** |
| **`/login`** | inchangé, sauf deux liens qui manquaient : le retour vers la porte, et « Pas de compte ? » |

**Le compte de questions n'est pas fixe, et c'est voulu :** quatorze pour une
micro-entreprise en franchise, seize pour une société assujettie. On ne vous
demande jamais le capital d'une entreprise qui n'en a pas, ni le numéro de TVA
si vous êtes en franchise.

**Le compteur ne grossit jamais.** Il annonce « 1 sur 16 » dès la première
question, et il descend si vos réponses retirent des questions — jamais
l'inverse. Un total qui grossit en cours de route se lit comme une mauvaise
surprise.

**Ce que vous passez n'est pas oublié.** L'écran de fin nomme ce qui manque —
« Il manque le SIRET, l'adresse et le capital, et 7 autres. À remplir quand vous
voulez dans Réglages, puis Mon entreprise. » Trois nommés au plus : une
énumération de huit se lit comme un reproche.

---

## Ce qui a été REFUSÉ, et ce que ça aurait coûté

**Les boutons Google et Apple** de l'écran 3 de la planche. Aucun de ces deux
fournisseurs n'est branché dans Atlas : les dessiner aurait donné deux boutons
qui ne font rien. Un bouton mort sur un écran de connexion, c'est quelqu'un qui
appuie trois fois puis abandonne, en croyant que l'application est en panne.

**Si vous les voulez pour de bon**, ce n'est pas un refus définitif : c'est un
travail à part — un compte développeur chez chacun, deux clés, et le rattachement
d'un compte Google à un compte Atlas existant. Dites-le et il sera chiffré.

---

## Ce qui a été fait AUTREMENT que la planche, et pourquoi

| | |
|---|---|
| **la porte est à `/bienvenue`, pas à `/login`** | la planche montre la porte en premier. La mettre à l'adresse `/login` demandait de toucher **140 navigations dans 129 fichiers de contrôle**, dont le seul qui éprouve une vraie connexion depuis votre espace. Un lot d'apparence qui réécrit cent vingt-neuf contrôles ne se relit plus. L'ORDRE que vous avez choisi est tenu : sans compte, on arrive à la porte |
| **les couleurs viennent de la charte « Nuit »** | et non des valeurs de la planche, qui en étaient à un cheveu. Il n'y a personne de connu à cette adresse, donc aucune apparence choisie à lire : on nomme Nuit, et on prend ses couleurs. Les recopier aurait fait vivre une huitième apparence et demie |
| **le bandeau des formes s'ouvre vers le HAUT** | vers le bas, il sortait de l'écran : les dernières formes et « Continuer » étaient hors de portée |

---

## Trois défauts trouvés en REGARDANT l'écran — aucun test ne les voyait

**1. La photo ne s'affichait pas.** Un carré gris à la place. Le serveur
renvoyait vers la porte tous les fichiers de l'application au lieu de les
servir — **y compris les deux pages de conditions que la porte vous fait
accepter**. On demandait donc d'accepter un texte qu'il était impossible de lire,
et l'icône d'Atlas sur l'écran d'accueil du téléphone était dans le même cas.

**2. « Se connecter » finissait sous le trait blanc de l'iPhone**, là où l'appui
ferme l'application au lieu d'ouvrir la page.

**3. Le bandeau des formes juridiques sortait de l'écran** (ci-dessus).

Les trois sont corrigés, et chacun a désormais son contrôle.

---

## Trois règles qui allaient exister en double

Elles ne se voient pas à l'écran, et ce sont les plus dangereuses.

| | |
|---|---|
| **le mot de passe** | la porte imposait **huit** caractères. Atlas en exige **douze** depuis l'audit de sécurité du 23 août. Vous auriez eu, vous, le mot de passe le plus faible du produit — plus faible que celui que vous imposez à vos salariés |
| **le capital social** | l'écran des réglages sait lire « 1 000 » avec son espace ; la porte, non. Un capital tapé normalement aurait fait échouer **la création entière du compte**, pour une case facultative |
| **la forme juridique** | la règle qui dit si une forme a un capital existait déjà, et la copie répondait **l'inverse** pour « Autre » |

Les trois sont ramenées à une seule écriture, employée des deux côtés.

---

## Ce qui reste à trancher — et c'est à vous

1. **Seize questions, est-ce trop ?** L'IBAN, le titulaire et les moyens de
   paiement ne servent qu'à la première facture : ils pourraient retourner dans
   les réglages et faire descendre à treize.
2. **La phrase des conditions, ou une case à cocher ?** C'est la phrase pour
   l'instant.
3. **La photo reste-t-elle fixe** alors que le reste de l'application suit
   l'apparence choisie dans les réglages ?

Et un rappel qui n'est pas du code : **les deux pages légales sont des
brouillons**. Elles sont en ligne et lisibles, mais la société éditrice n'existe
pas encore — le détail est dans `docs/A-FAIRE.md`.

---

## Les chiffres

| | |
|---|---|
| types, lint, mémoire du dépôt | **au vert** |
| les règles de la porte (13 contrôles) | **13 / 13** |
| la porte et ses retraits (8 contrôles) | **8 / 8** |
| les trois règles d'or — pas de pansement, pas de code mort, pas de spaghettis | **au vert** |
| parcours complet, du premier écran au compte créé | **joué en entier**, compte et entreprise vérifiés en base |
| batterie complète | *à jouer — vous êtes prévenu avant, vos autres sessions partagent le dossier* |
