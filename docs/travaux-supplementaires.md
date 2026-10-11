# Les travaux supplémentaires : ce qui manque, et comment le régler

Son constat du 31 août 2026 : *« si on effectue des travaux en plus chez un
client, on n'a aucun moyen de rajouter les TS sur la facture »*.

C'est exact. Ce document dit **pourquoi** l'application ne le permet pas
aujourd'hui, **comment les artisans font** en dehors de l'outil, et **quatre
solutions** avec ce que chacune coûte et ce qu'elle protège. Rien n'a été codé :
la décision lui revient.

---

## 1. Ce que l'application permet aujourd'hui — lu dans le code

| | |
|---|---|
| La facture naît du devis | `terminerChantier`, `src/server/repositories/factures.ts:201` — elle **recopie** les lignes du dernier devis **envoyé** |
| Ses lignes ne se modifient plus | l'écran facture n'offre qu'un seul champ : l'échéance (`FactureClient.tsx`) |
| Aucune notion d'avenant | aucune table, aucun champ, aucun écran — vérifié sur tout le dépôt |
| Le devis, lui, a des **versions** | `numeroVersion`, `src/server/repositories/devis.ts:275` |

**Une version n'est pas un avenant, et c'est tout le problème.** Une version
*remplace* : le client reçoit un nouveau prix global, et le prix qu'il avait
accepté disparaît. Un avenant *s'ajoute* : le client voit « ce qu'on avait
convenu » **plus** « ce qui s'est ajouté, que j'ai accepté le 12 ».

### Le contournement d'aujourd'hui, et pourquoi il ne tient pas

Rien n'interdit d'ajouter les lignes sur l'écran « Prix » du chantier, de
laisser l'application créer un devis v2, de l'envoyer, puis d'appuyer sur « Fin
de chantier ». Trois défauts, dont un grave :

1. **Si la facture existe déjà, même en brouillon, elle ne bouge plus.**
   `terminerChantier` commence par « une facture existe ? je la rends telle
   quelle » (`factures.ts:102`). Le devis v2 n'est **jamais** repris, et rien ne
   le dit à l'écran : le supplément disparaît en silence, et c'est la facture
   d'avant qui part chez le client. *(Lu dans le code, non rejoué à l'écran.)*
2. **Le client reçoit un prix global neuf**, pas un supplément — exactement ce
   qui déclenche les discussions au moment de payer.
3. **Rien ne trace son accord** sur le supplément. Or c'est cet écrit qui rend
   la somme exigible (§2).

### Ce que la documentation avait pourtant prévu

`docs/AGENT.md` §2.3, sur l'arrêt 3 : *« Un chantier finit rarement exactement
comme il a été devisé : travaux en plus, journée en moins, matériel non
utilisé. »* L'arrêt existe **pour ça** — et l'écran ne permet aucune correction.
Le besoin était écrit ; c'est l'écran qui est resté en deçà.

---

## 2. Comment les artisans font, en dehors de l'application

### La règle de droit, et elle est dure

L'**article 1793 du Code civil** (marché à forfait) : aucun supplément n'est dû
sans **accord écrit du client**, portant à la fois sur **les travaux** et sur
**leur prix**. Les deux conditions sont cumulatives, sans seuil de montant. Un
artisan qui fait les travaux en plus et les facture après coup peut se les voir
refuser **en entier**.

Hors marché à forfait, la preuve écrite est exigée dès **1 500 €** (art. 1359) ;
en dessous, un courriel, un SMS ou un compte rendu de chantier peuvent servir —
mais ce sont des preuves faibles, appréciées par un juge.

Deux échappatoires souvent citées, et à ne pas prendre pour des acquis : une
clause du devis initial prévoyant expressément les imprévus, et les travaux
indispensables restant sous ~10 % du devis. Elles se plaident ; elles ne se
garantissent pas.

### La pratique courante

| Ce qu'ils font | À quoi ça sert |
|---|---|
| **Avenant au devis**, chiffré et numéroté (« Devis 2026-014 — Avenant n°1 »), signé « bon pour accord » **avant** exécution | la seule façon sûre de se faire payer |
| **Bon de travaux supplémentaires** signé sur place — carnet autocopiant, ou photo du bon signé | le chantier n'attend pas le retour au bureau |
| **Courriel de confirmation** avec réponse écrite du client | filet des petits montants, faible mais mieux que rien |
| **Devis à quantités estimatives** (au métré) : le devis annonce des quantités prévisionnelles, la facture règle au réel | évite l'avenant sur les seuls **écarts de quantité** |
| Sur les gros chantiers : situations de travaux, mémoire de TS, décompte définitif | hors sujet ici — ce n'est pas son échelle |

### Ce que font les logiciels du métier

Obat, Vertuoza, iXbat, Tactidevis : tous ont l'**avenant comme document à part
entière**, rattaché à l'affaire, numéroté à la suite du devis, et une
**facturation qui cumule marché initial + avenants** sur un même document, en
blocs séparés. Aucun ne fait « éditer la facture à la main » : ce serait
facturer ce que le client n'a pas signé.

---

## 3. Les quatre solutions possibles

### A — L'avenant : un document lié au devis, qui s'ajoute au lieu de remplacer

Un « Avenant n°1 » se crée depuis le chantier, avec ses propres lignes (prix
positifs **et négatifs** : la journée en moins, le matériel non utilisé). Il
suit **le parcours du devis, déjà écrit** : PDF, envoi au client, page publique,
accord. La facture additionne le devis envoyé et les avenants acceptés, et le
PDF les montre en deux blocs, avec le récapitulatif.

| | |
|---|---|
| Ce que ça protège | l'accord écrit, la lisibilité pour le client, le prix convenu qui reste visible |
| Ce que ça coûte | une table (ou `type` + `parent_id` sur `devis`), la facture qui somme, le PDF, un écran |
| Ce qu'on réutilise | numérotation, envoi, page client, PDF, relevé de TVA : rien n'est à réinventer |
| Risque | c'est le plus gros des quatre lots |

### B — Rendre la facture modifiable tant qu'elle est en brouillon

Ajouter, retirer, corriger une ligne à l'arrêt 3, avant que la facture ne parte.

| | |
|---|---|
| Ce que ça protège | rien juridiquement — le client n'a signé aucun de ces montants |
| Ce que ça coûte | peu : quelques gestes sur un écran qui existe |
| Ce que ça règle | le geste manquant, immédiatement |
| Risque | **facturer sans accord = risque d'impayé**, et c'est lui qui le porte. Seul, ce lot déplace le problème du logiciel vers le tribunal |

À ne livrer **que** couplé à C, ou avec un avertissement à l'écran.

### C — Le bon de travaux supplémentaires, signé sur place

Sur le chantier : il dicte ou photographie ce qui s'ajoute, l'application chiffre
depuis son catalogue, **le client signe du doigt sur le téléphone**, et le bon
part par courriel dans la foulée.

| | |
|---|---|
| Ce que ça protège | l'écrit de l'article 1793, obtenu **avant** les travaux, sans retour au bureau |
| Ce qu'on réutilise | dictée, photo, chiffrage, page publique, envoi — tout existe déjà |
| Ce qui manque | la signature au doigt, et le stockage du bon signé |
| Risque | inutile seul : il faut que le bon **devienne** l'avenant (A) ou la ligne de facture (B) |

### D — Les quantités estimatives, réglées au réel

Une ligne de devis peut se déclarer « au réel » ; la facture demande alors la
quantité posée et recalcule. Le devis annonce la règle au client dès le départ.

| | |
|---|---|
| Ce que ça protège | les écarts de quantité — 40 m² de gazon au lieu de 35, une tonne de terre en plus |
| Ce que ça ne couvre pas | les travaux **nouveaux** : une haie qu'il n'avait pas prévue reste un avenant |
| Ce que ça coûte | un champ sur la ligne, un écran de saisie à l'arrêt 3 |

---

## 4. Ce qui est recommandé, et pourquoi

**C puis A**, dans cet ordre, et **B seulement à l'intérieur de A**.

1. **C d'abord** — le bon signé sur place. C'est là que l'argent se gagne ou se
   perd : un supplément accepté au jardin se facture ; le même, accepté d'un
   hochement de tête, se discute trois semaines plus tard.
2. **A ensuite** — l'avenant, qui porte le bon signé jusqu'à la facture. C'est le
   modèle du métier, et l'application a déjà les quatre cinquièmes des pièces.
3. **B jamais seul.** Une facture librement modifiable est un piège à impayés :
   elle donne le sentiment que c'est réglé, alors que rien n'est signé.

Et dans tous les cas, **le défaut du §1.1 se corrige** : une facture en brouillon
qui ignore silencieusement un devis plus récent est un mensonge qui part chez le
client.

---

## 5. Ce qu'il doit trancher

| Question | Pourquoi elle compte |
|---|---|
| **Une facture, ou deux ?** Le supplément se fond dans la facture finale (en bloc séparé), ou il part sur sa propre facture | change le calcul, le PDF, et le relevé de TVA |
| **L'application bloque-t-elle** une facturation de TS sans accord écrit, ou se contente-t-elle d'avertir ? | le blocage protège ; il gêne aussi le jour où le client a dit oui au téléphone |
| **La signature au doigt sur le téléphone** lui paraît-elle tenable devant un client, ou préfère-t-il la photo du bon signé sur papier ? | décide de la brique C |
| **Les travaux en MOINS** doivent-ils passer par le même document ? | une journée en moins est un avenant négatif, pas un oubli |

---

---

## 6. Son idée du 31 août au soir, et la réponse

*« Depuis cette page, avant d'envoyer la facture, il faut (si c'est légal)
pouvoir la modifier en stipulant que c'est du TS, et comme ça on a déjà toute
la chaîne de production de créée pour l'envoyer au client. »* — capture de
l'écran facture à l'appui.

**C'est la solution B, et il a raison sur les deux points.** La chaîne existe
déjà : PDF, canal SMS ou courriel, envoi, relevé de TVA. Le supplément n'a rien
à réinventer, il a juste à entrer **avant** l'arrêt de la facture.

### Est-ce légal ? Oui, avec trois bornes

| | |
|---|---|
| **Une facture en brouillon se corrige librement** | elle n'existe pas encore. C'est la facture **émise** qui est verrouillée, et se corrige alors par un avoir |
| **Chaque ligne porte sa quantité et son prix unitaire** | une ligne globale « Travaux supplémentaires : 320 € » ne satisfait pas les mentions obligatoires. « Dessouchage · 1 forfait × 320,00 € », si |
| **L'accord du client rend la somme exigible, pas la facture** | facturer un supplément non accepté est permis ; se le faire payer ne l'est pas toujours (article 1793) |

### Ce que ça change dans le dessin

- **Un bloc séparé**, jamais des lignes fondues dans celles du devis : le client
  retrouve au centime le prix qu'il avait accepté. Fondu, il lit un total qui ne
  correspond plus à son devis, et il appelle.
- **« Rien n'a changé depuis le devis ? » devient le geste.** La phrase était
  déjà sur son écran, sans réponse possible.
- **La trace d'accord a été RETIRÉE de l'écran, sur sa demande du 1ᵉʳ septembre
  à 00 h 56** : *« supprime aussi le client les a acceptés par SMS, e-mail, pas
  besoin de ça »*. Elle y était une minute plus tôt (quatre boutons : SMS,
  courriel, signé sur place, rien d'écrit).

  **Ce que cela change, et il faut le savoir avant de coder :** l'écran ne pose
  plus la question, mais le risque reste entier — un supplément non accepté par
  écrit peut être refusé (§2). Ce n'est plus la facture qui y répond, c'est le
  bon signé sur place (solution C), s'il le veut un jour.
- **Le titre du bloc ne porte que « Travaux supplémentaires »**, en doré, sur
  l'écran comme sur le PDF. La mention « acceptés par SMS » qui le suivait est
  partie avec la trace d'accord.

### Sa question du 1ᵉʳ septembre, 01 h 25 : les TS peuvent-ils avoir une autre TVA ?

*« Est-il possible que les TS n'aient pas la même TVA ? Je pense que oui, donc il
faut rajouter la possibilité de modifier la TVA juste pour les TS. »*

**Oui — et c'est plus grave qu'un confort.** Un paysagiste facture à trois taux :

| Taux | Quoi |
|---|---|
| **5,5 %** | entretien du jardin rendu comme service à la personne |
| **10 %** | travaux sur un logement achevé depuis plus de deux ans |
| **20 %** | création, terrasse, clôture, et tout client professionnel |

Le devis peut donc être à 10 % et le supplément à 20 % : une haie taillée, puis
une terrasse posée, ce n'est pas le même taux.

**L'article 268 bis du CGI tranche le reste : une facture qui ne ventile pas ses
taux est taxée EN ENTIER au taux le plus élevé.** Un supplément à 20 % noyé dans
une facture à 10 % ne coûte pas dix points sur le supplément — il fait passer
**toute** la facture à 20 %, à la charge de l'artisan.

D'où, dans la planche : **le taux se choisit à la ligne** (20 / 10 / 5,5), et les
totaux portent **une ligne de TVA par taux réellement employé**, avec le socle
sur lequel elle porte. Le PDF fait de même — sans quoi la ventilation ne prouve
rien : c'est le document qui compte, pas l'écran.

**Ce que cela impose au code, et il faut le savoir avant de commencer :** le taux
vit aujourd'hui sur la FACTURE (`factures.tauxTva`), pas sur la ligne. Il devra
descendre sur `lignes_facture`, et les totaux se recalculer par taux — le relevé
de TVA compris.

### Sa question du 1ᵉʳ septembre : où se remplit le formulaire ?

*« Lorsqu'il clique sur ajouter des TS, le mieux c'est que la facture s'ouvre et
qu'il la modifie directement, puis une fois validé il revient sur la page de la
facture prête à envoyer avec les TS ajoutés. Ou alors on fait un encadré qui se
déroule sous le "ajouter des TS" — mais du coup la page ne tiendra plus sur une
seule page. »*

Les deux formes sont sur la planche, en interrupteur, sur les mêmes chiffres.

| | |
|---|---|
| **Un écran à part** (proposé par défaut) | la facture revient entière, d'un coup, une fois validée ; on peut poser deux lignes de suite sans rouvrir le formulaire |
| **Déroulé sous le bouton** | le total et le bouton d'envoi sont poussés hors de l'écran au moment précis où on les regarde — c'est ce qu'il a lui-même vu |

**Avis donné : l'écran à part. IL A CHOISI L'AUTRE** — *« code la mienne,
déroule sous le bouton »* (1ᵉʳ septembre, 01 h 25). C'est sa décision, elle est
prise en connaissance du défaut qu'il avait lui-même relevé, et la planche ne
garde plus que cette forme : une planche qui conserve l'option écartée fait
rechoisir à chaque fois.

**Et tous les boutons s'alignent sur « Envoyer la facture »**, qui est le bouton
de référence : le bouton d'ajout vit désormais dans une plage, comme le canal
d'envoi. Mesuré, pas jugé à l'œil — même x, même largeur, au dixième de pixel.
Les raccourcis de prestations sont retirés.

La planche : `appli/ts-sur-la-facture.html`, calquée sur sa facture
F2026-000001.

---

*Sources métier :*
[Article 1793 et travaux supplémentaires](https://vite-un-avocat.fr/travaux-supplementaires-non-prevus-au-devis/) ·
[Refus de payer sans avenant](https://elige-avocats.com/le-client-est-il-en-droit-de-refuser-de-payer-les-travaux-supplementaires/) ·
[Avenant, OS et prix nouveaux](https://www.why.eu/facturation-travaux-supplementaires/) ·
[Travaux sans avenant écrit](https://www.habitatpresto.com/pro/conseils/juridique/travaux-supplementaires-sans-avenant-ecrit-refus-paiement) ·
[Le « bon pour accord »](https://www.habitatpresto.com/pro/conseils/administratif-fiscalite/bon-pour-accord) ·
[Quand et comment faire un avenant](https://www.courtierentravaux.org/quand-et-comment-faire-un-avenant-au-devis/)
