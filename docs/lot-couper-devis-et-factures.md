# Couper « Devis & factures » — le lot codé

**7 septembre 2026.** Ce que vous avez validé sur la planche
`https://florianmarrins0978-svg.github.io/Atlas-app/couper-devis-et-factures.html`
est codé. Voici ce qui a changé, ce que ça vous coûte, et ce qui reste.

---

## Ce que vous voyez maintenant

| Avant | Maintenant |
|---|---|
| un écran de **4 350 px** — six écrans et demi de votre téléphone — portant six sujets | une **entrée de quatre lignes**, et quatre écrans courts |

Les quatre lignes :

| |
|---|
| Ce qui s'imprime sur le devis |
| Mon message au client |
| Le numéro de mes documents |
| L'allure de mes devis |

**Les titres sont les vôtres**, mot pour mot : ce sont ceux de vos six blocs.
Deux blocs n'ouvrent aucune ligne — « Ce que votre devis dira » se recalcule tout
seul, « Ce qui ne se coupe pas » est obligatoire. Ils vivent dans le premier
écran, sous les interrupteurs qu'ils commentent.

**Rien n'est sorti de « Devis & factures ».** Vos trois réponses des 23 et
25 août tiennent : le sommaire des réglages garde ses **douze** lignes.

---

## Vos trois messages

Un par document — et il y en a **trois**, pas deux : le **compte rendu de
passage** partait avec le même texte. À deux, votre client aurait entendu votre
voix sur son devis et sa facture, celle d'Atlas sur le compte rendu.

**Ce que ça change vraiment.** La phrase du milieu — « Voici votre devis. Vous
pouvez le consulter et choisir votre date… » — était écrite par Atlas et
verrouillée. C'était le seul morceau de votre message que vous ne pouviez pas
toucher, et c'est précisément celui que vous vouliez écrire. Il est à vous.

**Ce qui reste à Atlas :** les mots dorés, qui se remplissent seuls — le prénom,
le mot du document, le numéro, l'échéance, votre entreprise. **Deux ne se
retirent pas :** le lien, et le mot du document.

- sans le lien, votre client n'ouvre rien et votre planning ne reçoit aucune date ;
- sans le mot du document, il ne sait pas s'il reçoit un devis à signer ou une
  facture à payer.

**Et l'échéance emporte ses mots.** Quand le délai de paiement est éteint, il n'y
a pas d'échéance : « , à régler avant le … » disparaît en entier, plutôt que de
laisser « Voici votre facture F2026-0008, à régler avant le . » chez votre
client.

**Votre texte actuel n'est pas perdu :** il devient celui du **devis**. Les deux
autres partent du message d'Atlas.

---

## Six typographies au lieu de dix

Vous m'avez laissé trancher. Quatre partent, chacune pour une raison qui se voit
sur un devis :

| Retirée | Pourquoi |
|---|---|
| Source Sans | à cette taille, on ne la distingue pas d'Inter |
| Work Sans | idem — trois linéales neutres, c'est deux de trop |
| Libre Baskerville | très large : le même devis prend une page de plus |
| Playfair Display | ses déliés sont des cheveux ; à l'impression, ils disparaissent |

**Un document déjà réglé sur l'une d'elles n'est pas perdu** : il bascule sur la
plus proche — Source Sans et Work Sans vers Inter, Libre Baskerville vers
Merriweather, Playfair vers EB Garamond. Sans ça, il serait retombé sur la police
de l'appareil, sans un mot.

**En revanche, une photo de devis dans une police retirée n'est pas approchée :**
l'écran dit « la police n'a pas été reconnue — à choisir à la main ». Poser la
plus ressemblante repeindrait vos documents d'après une photo.

---

## Le doré, et ce que ça a fait sortir

**Vous aviez raison sur ce que vous voyiez, et c'était ma planche.** Dans
l'application, le doré n'a jamais été absent : c'est la couleur d'accent **par
défaut** de vos documents, et la première pastille la porte.

**Mais en le vérifiant, un vrai défaut est sorti**, et il n'était écrit nulle
part : l'aide de ce réglage annonçait « le trait sous le titre, les intitulés,
**et le total à payer** ». Le total s'écrit à l'encre — il n'a jamais changé de
couleur. Vous auriez changé l'accent, regardé votre total, et cru à une panne.

La phrase est corrigée, et l'aperçu de l'écran aussi, qui coloriait le total lui
aussi.

---

## Ce que ça coûte, et où

| | |
|---|---|
| **quatre adresses neuves** | `/reglages/documents/conditions`, `…/message`, `…/numero`, `…/allure` |
| **une migration** | **0075** — deux colonnes de plus, et votre message actuel réécrit |
| **treize suites** adaptées | elles visaient l'écran unique, une police retirée, ou l'ancienne règle « un message pour tous » |
| **rien dans les PDF** | ce qui s'imprime sur vos devis ne change pas d'une virgule |

**Ce qui a été retiré des contrôles, et pourquoi il fallait le retirer.** Une
suite exigeait « un seul message pour tous » — votre règle du 23 août, que vous
avez renversée le 7 septembre. Une autre exigeait deux aperçus côte à côte, que
vous avez fait supprimer le même jour. On adapte le contrôle, on ne remet pas ce
que vous avez fait enlever.

---

## Ce qui est vérifié, et ce qui ne l'est pas encore

| | |
|---|---|
| types, lint | **verts**, 0 erreur |
| mémoire du dépôt | **verte** |
| suites sans base — message, allure, polices, lecture de photo, rubriques | **vertes** |
| **suites base et navigateur** | **PAS ENCORE JOUÉES** |

**Je ne vous dis pas que c'est éprouvé, parce que ça ne l'est pas.** La batterie
complète demande la migration 0075 appliquée, la base, et le port 3000 — vous
m'avez demandé de ne pas y toucher pendant que la vôtre tournait. Dites-moi quand
votre poste est libre : je l'applique, je joue la batterie entière, et je vous
rends ses chiffres.

---

## Ce qui reste ouvert

| | |
|---|---|
| **« fiche client »** | vous appelez ainsi le troisième document ; le dépôt l'appelle **compte rendu de passage**, et c'est ce nom qui est écrit partout. Le renommer se décide — dites-le, et je le fais d'un bloc |
| **deux façons d'enregistrer** | l'allure et le numéro s'écrivent tout seuls, les interrupteurs et les messages attendent un bouton. Coupé, c'est plus visible : deux écrans voisins ne se comportent pas pareil |
| **Lot 6** | le dernier des Réglages : Équipe, notifications, mot de passe, données, couleurs, IA, abonnement, compte |
