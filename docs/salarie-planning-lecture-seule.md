# Le planning du salarié passe en lecture seule

*30 août 2026. Décision du patron, appliquée au serveur puis à l'écran.*

---

## 1. Ce qui a été décidé, et ce que c'était avant

> **« Un salarié peut uniquement CONSULTER son planning. Il ne doit pouvoir
> effectuer AUCUNE modification depuis le planning. »**

Cette phrase tranche la seule question que le lot de clôture avait laissée
ouverte, et elle la tranche **plus largement** qu'elle n'était posée : la
question était « peut-il supprimer un chantier ? », la réponse ferme les six.

**Ce qu'un salarié pouvait faire jusqu'ici**, depuis son écran, sans rien
forcer :

| Le geste | Ce qu'il coûtait |
|---|---|
| supprimer un chantier | suppression douce — mais **aucun écran ne la restaure** |
| le poser sur un jour | une équipe envoyée où personne ne l'attend |
| le déplacer dans la journée | un client prévenu pour le matin, l'équipe l'après-midi |
| le retirer du planning | le chantier disparaît de la semaine de tout le monde |
| réécrire le pense-bête | « penser à prendre le broyeur » effacé |
| cocher une autre équipe | l'agenda extérieur du patron réécrit avec |

Les sept actions du planning vérifiaient **quel** chantier — le lot précédent
avait posé ce tamis. Aucune ne vérifiait **si** la personne avait le droit
d'écrire.

---

## 2. La sécurité est au serveur, pas dans l'écran

Sa consigne, mot pour mot : *« Ne te contente surtout pas de retirer ou masquer
les boutons dans l'interface. »*

**Une règle, un seul endroit.** `peutModifierLePlanning` dans
`src/lib/acces-roles.ts` — le fichier où toutes les questions de rôle se
tranchent déjà.

**Une garde, en tête de chaque action qui écrit.**
`exigerEcritureSurLePlanning` dans `src/server/garde-action.ts`, appelée par les
six actions de `src/app/planning/actions.ts`.

**Elle passe AVANT le contrôle de portée**, et ce n'est pas un détail : la
portée interroge la base — l'équipe de la personne, puis les chantiers de cette
équipe. Un salarié doit être refusé sans qu'on paie ces deux requêtes, et
surtout sans qu'un chantier hors portée réponde plus lentement qu'un chantier de
son équipe. Ce délai-là se mesure, et il dirait à qui cherche lesquels sont les
siens.

### Deux choses qui n'ont PAS bougé, parce qu'il l'a demandé

| | |
|---|---|
| **la portée de lecture** | il voit exactement ce qu'il voyait — tous les chantiers, ou ceux de son équipe si le patron l'a resserré |
| **sa feuille de chantier** | le devis sans un seul prix, son unique document, reste ouverte |

Et le **patron** comme le **commercial** gardent exactement leurs droits. C'est
éprouvé, pas supposé : une suite le vérifie geste par geste — sans elle, on
serait passé au vert en fermant la porte à tout le monde.

### Ce que l'écran fait, et ce qu'il ne fait pas

L'écran ne protège rien. Il évite seulement de proposer un geste qui sera
refusé — un bouton qui répond « action indisponible » se lit comme une panne, et
c'est le patron qu'on appellerait un lundi matin.

Disparaissent pour un salarié : la pastille d'équipe cochable, « Déplacer »,
« Retirer », « Ajouter un chantier », la section « Sans date », le tiroir
d'annulation, et le cadre de saisie de la note.

**La note, elle, se lit** — c'est la raison même pour laquelle elle existe
(*« elle peut rester là, car les salariés auront accès au planning »*, 23 août).
Un cadre grisé aurait été le mauvais choix : il se touche, il ne répond pas, et
l'on croit à une panne.

---

## 3. Ce qui prouve que ça tient

### La requête fabriquée — l'essai qui compte

`scripts/test-salarie-planning-lecture-seule-e2e.ts` ne clique sur aucun bouton
absent. Il fait ce que le patron décrit :

1. le patron écrit une note depuis son planning. La suite **intercepte** l'appel
   au vol : son adresse, son identifiant d'action serveur, son corps ;
2. elle rejoue **exactement** cette requête avec le cookie du salarié, sur un
   chantier dont il connaît l'identifiant ;
3. elle relit la base.

L'identifiant de l'action est lu au vol et jamais écrit en dur : il est fabriqué
à la compilation, et le figer ferait rougir la suite au prochain build sur une
fausse alerte.

**Et l'inverse est éprouvé aussi** : la même requête, rejouée par le patron,
écrit pour de bon. Sans cette moitié, on serait vert en ayant rendu le
pense-bête inutilisable pour tout le monde — un refus qui serait une panne, pas
une garde.

### L'essai négatif : la garde retirée, puis rendue

Il l'a demandé, et il a eu raison de le demander.

| | |
|---|---|
| garde retirée de l'action du pense-bête | **le salarié écrit — réponse 200.** Le contrôle rougit, et son message nomme le défaut |
| garde rétablie | vert, et le fichier rendu à l'octet près |

Ce rouge-là dit ce qu'aucune assertion ne dirait : **avant ce lot, il le pouvait
pour de bon.**

Un second essai négatif vit dans la suite base, et celui-là **ne touche à aucun
fichier** : il vérifie que la garde d'avant — celle de la portée — laisse
toujours passer le salarié. Si elle se mettait un jour à refuser, le contrôle
principal deviendrait vert pour la mauvaise raison. C'est le faux vert le plus
dangereux, celui qui rassure.

### Et l'écran, regardé

Deux captures dans `artifacts/screenshots/salarie-planning-lecture-seule/` — la
sienne et celle du patron, côte à côte. Quatre défauts réels de ce dépôt sont
sortis d'une image regardée et d'aucun test vert : l'écran du salarié devait
rester un écran, pas une page trouée. Il l'est.

---

## 4. La vérification ciblée : y avait-il une seconde porte

Oui. **Une, et elle était pire que celle qu'on fermait.**

`src/app/chantiers/[id]/photos-actions.ts` ne portait **aucune** garde. Un
salarié pouvait ajouter une photo à n'importe quel chantier de l'entreprise, et
en **supprimer** n'importe laquelle — cette fois pour de bon : un effacement en
base, pas une corbeille.

**Pourquoi personne ne l'avait vu.** Le contrôle du lot précédent lisait deux
listes de fichiers **écrites à la main**, et toutes deux ne nommaient que des
`actions.ts`. Ce fichier-là s'appelle `photos-actions.ts`. La suite était verte :
elle ne mentait pas, elle ne regardait pas.

**Ce qui a été corrigé, et ça vaut plus que le correctif.** Le contrôle relève
désormais **tout** fichier « use server » du dépôt — trente-six aujourd'hui — et
ce qui n'a pas de garde doit s'expliquer **par écrit**, dans une table
d'exemptions où chaque entrée porte sa raison. Trois familles y sont admises, et
aucune quatrième : ce qui s'appelle avant la connexion, ce qui est public par
jeton, et ce qui n'écrit que sur la personne elle-même.

**Deux fausses alertes, corrigées dans le contrôle et non dans le produit.** Les
six actions de la fiche paysage et les trois du vocabulaire étaient dénoncées
comme nues alors qu'elles portent des gardes **plus strictes** — `estProprietaire`
par un aide local, `exigerEditeur`. Leur ajouter une seconde garde aurait mis
deux règles pour une porte, et c'est exactement ce que le dépôt interdit. Le
contrôle suit désormais un niveau d'indirection ; un seul, délibérément — un
contrôle qui suit les imports finit par tout accepter.

**Les routes d'API ont été passées en revue** : la seule qui écrit et qui n'est
pas l'authentification ou la purge est celle des notes vocales, et elle est
fermée au salarié par la garde des routes. Aucune autre porte d'écriture.

---

## 5. Ce qui reste ouvert

**Rien sur ce sujet.** La décision est appliquée, éprouvée, et le point est
barré dans `TODO.md`.

Deux choses, qui ne dépendent pas de ce lot :

- **l'infrastructure** — brancher le planificateur de purge et poser la sonde,
  tout est écrit pas à pas dans `docs/DEPLOIEMENT-PURGE.md` ;
- **une question pour lui, si elle l'intéresse** : le **commercial** garde le
  droit d'écrire sur le planning. C'est ce que dit sa règle du 23 août — *« les
  commerciaux auront accès à l'entièreté de l'application, sauf aux réglages »* —
  et rien n'a été resserré sur lui, conformément à sa consigne. S'il veut que le
  commercial pose des chantiers mais n'en supprime pas, c'est une seconde
  décision, et elle n'a pas été prise à sa place.

---

## Les chiffres

| | |
|---|---|
| **types** | 0 erreur |
| **lint** | 0 erreur |
| **mémoire du dépôt** | cohérente, 8 fichiers vérifiés |
| **suites base** | **267 / 267** |
| **suites navigateur** | **117 / 117** |
| **connexion derrière un proxy** | réussie, dans un vrai navigateur, sous une origine étrangère |

**Batterie complète au vert.**

Deux suites neuves : `test-salarie-planning-lecture-seule-db.ts` (18 contrôles) et
`test-salarie-planning-lecture-seule-e2e.ts` (6 contrôles, dont la requête
forgée). Une réécrite : `test-actions-gardees-db.ts`, qui relève désormais les
36 fichiers « use server » du dépôt au lieu de deux listes manuelles.

### Ce qui a été trouvé en cours de route, et corrigé

**La batterie a fait rougir mon propre écran.** La pastille d'équipe apparaît à
deux endroits ; je n'en avais traité qu'un. Le contrôle « aucune commande de
modification » l'a dénoncé — mais seulement en batterie, parce que la suite
lancée seule tournait sur une entreprise **sans salarié**, où cette pastille ne
se dessine pas. Elle mesurait zéro et passait au vert.

Corrigé des deux côtés : la pastille passe par une seule pièce qui connaît le
droit d'écriture, et la suite pose maintenant son décor — deux salariés, un
coché sur le chantier — puis **vérifie que le décor a pris** avant de conclure.
