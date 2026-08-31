# Le devis du client : verrouillé, dans un écran, et récupérable

*31 août 2026 · branche `claude/devis-sms-client-fixes-e79wdh`*

**Tes trois captures**, prises sur le téléphone de ta cliente : la page reçue par
SMS qu'il fallait faire défiler, le PDF qu'Acrobat proposait de modifier, et
l'écran de retour où il ne restait plus rien après l'acceptation.

---

## Les trois points, en trois lignes

| Ce que tu as demandé | État |
|---|---|
| « le choix de la date doit tenir sur une seule page » | **fait** — 770 px demandés pour 664 disponibles ; il en reste 630 |
| « il pouvait modifier le devis, à corriger absolument » | **fait** — le PDF part verrouillé : impression et copie oui, modification non |
| « il doit encore pouvoir le télécharger » | **fait** — une touche « Télécharger mon devis », en un appui |

---

## 1. Tout tient dans un écran

Mesuré sur un téléphone de 390 × 664, barre d'adresse déduite — la mesure du
dépôt, pas un chiffre choisi pour l'occasion. Vérifié aussi sur un écran plus
petit (360 × 640) : ça tient.

**Ce qui a été gagné, et où :**

| | |
|---|---|
| **40 px** | la case du message rejoint celle de la date : deux choses qui se répondent n'ont pas besoin de deux cadres |
| **30 px** | la phrase grise sous « Une correction avant d'accepter », et le bouton éteint qui l'obligeait |
| **18 px** | le nom de l'entreprise, remonté sur la ligne du numéro de devis |
| **18 px** | « vous pouvez laisser un mot » réuni avec l'intitulé du champ |
| **15 px** | la mention de preuve, de trois lignes à une |
| **45 px** | marges et hauteurs de boutons resserrées |

**Ce qui n'a PAS été enlevé, et pourquoi :** les trois totaux (il accepte un
montant), le lien vers le devis complet (son accord porte sur le contenu exact),
l'adresse du chantier, et les trois issues. La zone de message reste une zone —
sur deux lignes au lieu de trois : un champ d'une seule ligne dissuade d'écrire,
et c'est ce champ qui évite qu'une coquille devienne un refus.

**Une chose a été faite autrement que tu ne l'aurais peut-être imaginé.** Le
bouton « Une correction avant d'accepter » était éteint tant que rien n'était
écrit, avec une phrase grise dessous pour dire pourquoi. Les deux sont partis :
le bouton répond maintenant, et c'est sa réponse qui dit ce qui manque. Rien ne
part sans un mot — ça, c'est vérifié.

**Ce que la mesure ne couvre pas :** si ton client ouvre le calendrier pour
proposer une autre date, ou coche une date proche (qui fait apparaître la case
de rétractation), la page s'allonge. Ce sont des gestes qu'il fait, pas ce qu'il
voit en arrivant.

---

## 2. Le PDF ne se modifie plus

**Ce qui se passait :** un PDF ordinaire est modifiable, et Acrobat sait très
bien le faire. Rien dans ton devis ne lui disait de ne pas le proposer.

Le devis part désormais **verrouillé**. Ce que ton client peut encore faire, et
ce qu'il ne peut plus :

| Encore permis | Interdit |
|---|---|
| ouvrir sans mot de passe | modifier un montant, un texte |
| imprimer, en pleine qualité | ajouter du texte, une image, une annotation |
| copier une adresse | retirer ou ajouter une page |
| faire lire à voix haute | remplir un champ |

**La facture et la feuille de chantier sont protégées de la même façon** : un
seul endroit dans le code s'en occupe, sinon on aurait oublié l'une des trois —
et on l'aurait appris chez un client.

### Ce que je ne te promets PAS, et il faut que ce soit clair

**Ce n'est pas un coffre-fort.** Le format PDF est public : quelqu'un de
déterminé, avec les bons outils, réécrit n'importe quel PDF. Ce qui change, et
c'est ce qui compte pour toi :

- ton client ne modifie plus son devis **par mégarde ou d'un doigt**, sur son
  téléphone ;
- le document qui fait foi reste **celui qu'Atlas a archivé au moment de
  l'envoi** — c'est lui que ton client a accepté, avec la date et l'heure.

Te dire « personne ne pourra jamais le modifier » serait te promettre ce
qu'aucun format de document ne tient.

### Le vrai danger, et ce qui le tient

Le risque n'était pas de mal verrouiller : c'était de fabriquer un devis que
**plus personne n'ouvre**. Un fichier mal chiffré ne s'affiche nulle part, et ton
client n'aurait plus rien vu du tout.

Un contrôle a donc été ajouté qui ne fait pas confiance à Atlas : il demande au
lecteur PDF de Chrome — qui ne sait rien de cette application — d'ouvrir le
devis et de le dessiner. Et pour être sûr que ce contrôle sait dire non, on lui
donne le même devis dont **un seul chiffre** de la clé a été faussé : celui-là,
le lecteur le refuse en réclamant un mot de passe.

Vérifié en plus avec `qpdf`, un outil indépendant : les autorisations sont bien
celles du tableau ci-dessus, et le contenu se relit correctement.

---

## 3. Le devis reste à portée après l'acceptation

**Ce qui se passait :** ton client accepte, revient sur le lien du SMS deux jours
plus tard, et trouve « Devis accepté » — sans le devis. Le lien devenait un
cul-de-sac le jour même de l'accord, et il devait t'appeler pour récupérer la
pièce qu'il venait de signer.

Il y a maintenant une touche **« Télécharger mon devis »** à deux endroits : sur
la confirmation, juste après l'acceptation, et sur l'écran de retour.

**Un détail qui compte sur un téléphone :** le fichier **descend** dans ses
documents au lieu de s'ouvrir dans le lecteur du navigateur. Ouvert dans le
lecteur, on croit l'avoir enregistré alors qu'on n'a fait que le regarder — et
il n'en reste rien quand on ferme l'onglet.

**Ce qui n'a pas été fait, et c'est un choix :** rien n'est proposé après un
refus (on ne propose pas d'emporter un devis auquel on vient de renoncer), ni
après une demande de correction (le document va changer). Si tu veux le
contraire, dis-le : c'est deux lignes.

---

## Les chiffres de la batterie

| | |
|---|---|
| suites base | à compléter à la clôture |
| suites navigateur | à compléter à la clôture |
| page du client | 630 px pour 664 disponibles |
| contrôles neufs | 6 sur la protection du PDF, 2 sur son ouverture par un lecteur tiers, 3 sur la page du client |

---

## Ce qui reste ouvert

| | Qui peut trancher |
|---|---|
| Faut-il proposer le devis après un refus ou une correction ? | toi |
| La page ne tient plus si tu ajoutes quoi que ce soit à cet écran — la mesure le dira, mais il faudra choisir quoi retirer | toi, le jour où ça arrive |
