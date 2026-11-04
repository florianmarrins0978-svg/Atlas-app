# La mise en page du devis, codée (4 novembre 2026)

Ta demande : *« Dans ce cas, c'est très bien, tu peux coder ça, mais ne
lance pas de batterie. »*, devant la planche
`appli/soignee/devis-mise-en-page.html`.

**Où c'est :** sur la branche `lot/mise-en-page-devis`. **Pas sur `main`** :
le lot touche le PDF du devis et de la facture et ajoute deux colonnes en
base, donc il lui faut la batterie entière avant de partir chez toi. Elle
n'a pas été jouée, à ta demande.

## Ce qui est codé, point par point

| Point de la planche | Verdict | Fichier |
|---|---|---|
| Les pages se remplissent jusqu'au numéro de page | codé | `src/server/pdf/document-commun.ts` |
| « Devis établi par… » et la signature presque collés sous l'IBAN, sur 4, 20 et 30 lignes | codé, 22,4 points | idem |
| Ton devis de 4 lignes tient toujours sur une page | vérifié | `scripts/test-mise-en-page-devis.ts` |
| Les notes accompagnent les modalités, jamais les modalités seules en haut d'une page | codé | idem, `sautQuiManque` |
| Toucher une ligne, les totaux, les notes ou les modalités dans « Aperçu du PDF » | codé | `src/app/documents/pdf/VisionneusePdf.tsx` |
| « Nouvelle page ici », bouton plein et arrondi | codé | idem |
| La puce « Saut de page » et sa croix entre les deux pages | codé | idem |
| « Tout remettre » | codé | idem |
| La phrase « Touchez une ligne pour commencer une nouvelle page à cet endroit. » | codé, partie au premier saut ou sur « Compris » | idem |
| Le saut gardé avec le devis | codé | migration `drizzle/0164_sauts_de_page_du_devis.sql` |
| Un devis envoyé garde ses sauts, « Corriger le devis » les reprend | codé | `src/server/repositories/devis.ts` |
| Avec l'allure importée (autre police, logo) | marche : le saut suit sa ligne, pas une hauteur | `src/lib/sauts-de-page.ts` |

## Tes deux réponses du 4 novembre, codées le même jour

Sur `appli/soignee/devis-mise-en-page-questions.html` : *« dans la 1 oui la
B »*, *« d'affilée »*, puis *« B »*.

| Ton choix | Ce qui est codé | Fichier |
|---|---|---|
| 1B : un espace sans changer de page | une ligne touchée offre « Nouvelle page » et « Un espace ici » | `VisionneusePdf.tsx`, `document-commun.ts` |
| plusieurs d'affilée | « Encore un espace » en ajoute un, la ligne reste choisie ; la puce dorée dit « 2 espaces », sa croix les retire | idem, `src/lib/sauts-de-page.ts` |
| quand la page est pleine | « Plus de place sur cette page. » à la place du bouton ; il reste « Nouvelle page » | `devis.ts`, `ajouterUnEspaceDevant` |
| 2B : le saut se voit dans l'écran du devis | la puce verte « Saut de page » entre les lignes, avec sa croix ; il se pose toujours dans l'aperçu | `SautDuDevis.tsx`, `DevisCompletClient.tsx` |

**Un détail que tu n'as pas vu sur la planche, et qui compte.** Sur ton
devis de 4 lignes, un espace devant les notes ne laisse plus la place de la
signature : la fin du devis passerait alors en page 2, et l'espace s'y
perdrait. Atlas le voit avant d'écrire, et te dit « Plus de place sur cette
page. ».

**Sur un téléphone étroit** (moins de 375 points de large), les deux boutons
passent sur deux lignes plutôt que de déborder.

## Ce qui a été fait autrement, et pourquoi

- **Le pied se mesure**, il ne fait pas 72 points comme sur la planche : les
  mentions de décennale et de médiateur n'ont pas la même longueur chez
  chaque artisan.
- **La facture prend les mêmes règles de remplissage**, sans sauts à elle :
  une facture émise ne se remet pas en page.
- **Le PDF sans prix n'a pas de sauts** : ses lignes n'ont pas la même
  hauteur, un saut posé pour le devis complet y tomberait mal.

## Ce que j'ai trouvé en le codant, et corrigé

**Un saut accroché à la ligne du devis aurait disparu au premier prix
changé.** Atlas efface et recopie les lignes d'un devis brouillon à chaque
modification, chacune avec un numéro neuf. Le saut est donc accroché à la
ligne de prix du chantier, qui, elle, ne change pas.

**Le bouton « Nouvelle page ici » était arrondi mais pas vert.** Vu sur la
capture du vrai écran, corrigé.

## Ce qui a été éprouvé

| | |
|---|---|
| Mise en page, de 1 à 40 lignes, devis et facture | 10 cas verts |
| Les sauts en base, sous le rôle de l'appli | 6 cas verts, rouges si le saut s'accroche à la mauvaise ligne |
| L'aperçu n'ouvre la coupe que sur un devis | 2 cas verts, rouges si une facture passe |
| Types, style, mémoire, tirets, flèches, code mort, couches, pansements | verts |
| Le geste, dans un navigateur, sur le poste | couper la 6e ligne, elle passe en page 2, « Tout remettre » la ramène |
| Les espaces, dans le PDF | 7 cas verts de plus, rouges avant le code |
| Les espaces, en base | 5 cas verts de plus ; le refus « Plus de place » rougit si on le retire |
| Ton geste, dans un navigateur, en suite qui reste | 9 gestes verts, chaque écriture vérifiée en base ; rouge si la puce manque à l'écran du devis |
| **La batterie entière** | **non jouée, à ta demande** |

## Ce qui reste ouvert

| | Qui |
|---|---|
| La batterie entière, puis `main` | toi, quand tu le dis |
