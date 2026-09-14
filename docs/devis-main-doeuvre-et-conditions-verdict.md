# Le devis : la main d'œuvre, et les conditions — 14 septembre 2026

*Vos trois remarques de minuit, devant la planche « Remise, main d'œuvre,
conditions ». Un verdict par point, ce qui a été corrigé, ce qui reste à vous.*

---

## En une phrase

**La main d'œuvre s'effaçait sur un devis sans ligne — corrigé.** Les
conditions générales pouvaient être vidées par une photo de devis — corrigé
aussi. Pour les phrases sous le devis, vos deux planches disent deux choses
différentes : c'est à vous de trancher.

---

## 1. « Je mets le prix, elle s'efface toute seule »

| | |
|---|---|
| **Reproduit** | oui — sur un devis **sans aucune ligne** (un chantier neuf, ou des lignes pas encore chiffrées). Le 450 tapé partait au premier enregistrement, sans un mot |
| **Sur un devis qui a des lignes** | elle tenait déjà, y compris au rechargement et après le PDF |
| **Pourquoi** | « dont main d'œuvre » ne peut pas dépasser le total HT — et un total de zéro était pris pour une limite de zéro |
| **Corrigé** | sans ligne, le montant se garde tel quel ; dès qu'une ligne existe, la limite se pose (si les lignes font 380 €, la main d'œuvre ne peut pas dire 450) |
| **En plus** | au rechargement elle s'écrivait « 450.00 » ; elle s'écrit « 450 » |

## 2. « Il manque la partie que le client doit voir »

| | |
|---|---|
| **Reproduit ici** | non — sur `main`, le PDF porte vos conditions générales en page 2, après le bon pour accord, et Réglages → Documents → « Ce qui s'imprime sur le devis » montre la case, remplie, modifiable en entier |
| **Trouvé en lisant** | un défaut qui les efface : **photographier un devis** (Réglages → Allure) réécrivait vos réglages sans la case des conditions générales, née le 13 — elle repartait à « effacé ». Plus rien après le bon pour accord, case éteinte dans les Réglages |
| **Corrigé** | un réglage qu'on ne touche pas ne bouge plus, quel que soit le chemin (assistant, photo, écran) |
| **Si vous le voyez encore** | une capture de Réglages → Documents → « Ce qui s'imprime sur le devis », en bas de l'écran, tranche. Si la case est éteinte : l'allumer remet le texte d'origine |

## 3. « Les conditions sous le devis ne sont pas les bonnes »

Vos deux planches écrivent le bloc « Notes / conditions » différemment :

| La planche | Ce qu'elle écrit |
|---|---|
| **l'acompte** (12 septembre au soir, vos trois retours) — **c'est ce que l'appli fait** | « Acompte de 30 % à la signature, soit 853,20 €. » — et « Reste à régler après acompte » dans les totaux |
| **Remise, main d'œuvre, conditions** (12 septembre, codée le 13) | « Mode de règlement : 30 % à la commande, solde à réception de la facture. » · « Montant à régler à la commande : 573,12 € » · « Solde restant à régler : 1 337,28 € » |

La première avait été retenue sans vous le dire. **Laquelle voulez-vous ?** —
ou, si « pas les bonnes » désigne autre chose, une capture du bas de votre
devis.

---

## Ce qui a été vérifié

| | |
|---|---|
| suites pures et base | `test-planche-b-devis`, `test-planche-b-devis-db`, `test-conditions-documents`, `test-conditions-sur-le-devis`, `test-lecture-allure-devis`, `test-agent-gestes` — vertes, et les cas neufs rougissent sur l'ancien code |
| suites navigateur | planche B, acompte, remise — 3/3 vertes, sur un atelier à part |
| à la main | vos gestes rejoués dans un navigateur à la largeur d'un téléphone : devis vide, devis chiffré, rechargement, PDF, Réglages |
| types, lint | verts |

**Non éprouvé ici :** ce que votre espace affiche à vous. Une capture vaut
mieux qu'une hypothèse.
