# La décennale et le médiateur — ce qui a été fait

**16 septembre 2026.** Votre demande : *« met les crochets en rouge dans le
texte pour qu'on les trouve vite »*, puis *« est-ce obligatoire les trucs avec
crochets ? »*

---

## 1. Le rouge : refusé, et pourquoi

**Ce n'était pas faisable.** La case des conditions générales est un champ de
saisie : il n'affiche que du texte nu, sans couleur. La seule façon d'y arriver
aurait été de poser un calque coloré derrière le champ — trois couches
superposées, et plus personne pour savoir laquelle décide. C'est exactement le
pansement que le dépôt refuse.

**Et cela aurait traité le symptôme.** Le vrai défaut n'est pas que les
crochets se cherchent : c'est qu'une information d'entreprise — celle qui ne
change qu'une fois par an — se retapait **dans un texte**. Donc se recopiait.
Donc allait diverger au premier changement d'assureur.

## 2. Les deux crochets sont obligatoires

Vous ne pouvez ni les supprimer ni les laisser vides.

| | |
|---|---|
| **assureur, n° de contrat, couverture géographique** | à faire figurer sur vos devis dès que votre activité relève de la décennale (terrasse, mur, dallage, réseau enterré) |
| **médiateur de la consommation** | exigé de tout professionnel qui vend à des particuliers ; il faut y adhérer |

Votre assureur confirmera lesquels de vos travaux relèvent de la décennale.

## 3. Ce qui a été codé à la place

**Votre accord du 14 septembre**, planche `appli/decennale-et-mediateur.html`,
qui attendait depuis dans `TODO.md`.

| | |
|---|---|
| **Deux blocs dans Mon entreprise** | après « Pour être payé » : assureur, n° de contrat, couverture ; nom et adresse du médiateur |
| **Remplis une fois** | comme le SIRET. Plus rien à retaper dans le texte |
| **Les articles 9 et 11** | se remplissent tout seuls. Les crochets disparaissent |
| **En bas du devis ET de la facture** | « Assurance décennale : … » et « Médiateur de la consommation : … » |
| **Vide** | rien ne s'imprime, et l'écran le dit sous le champ |

## 4. Trois décisions prises sans vous les demander

1. **Le nom commande.** Sans l'assureur, rien ne s'imprime — même si le numéro
   de contrat est saisi. Un numéro seul ne désigne aucune compagnie : il ne
   prouve rien et ne se vérifie pas.
2. **Un crochet dont la valeur manque RESTE un crochet.** Le faire disparaître
   à vide laisserait partir « d'une assurance décennale : . » chez un client —
   une phrase fausse à la place d'un manque visible.
3. **Les valeurs sont figées sur chaque document.** Changer d'assureur ne
   réécrit pas un devis déjà parti : c'est cette pièce qui prouve votre
   couverture au moment du chantier.

## 5. Ce qui a changé sur l'écran des conditions générales

La ligne rouge disait « 2 crochets à remplir avant d'envoyer un devis ». Elle
dit maintenant « … à remplir **dans Mon entreprise** », et elle disparaît dès
que les deux blocs sont remplis. Vérifié à l'écran, dans les deux sens.

## 6. Ce qui a été éprouvé

| | |
|---|---|
| `test-mentions-obligatoires.ts` | 12 cas — ce qui s'imprime, ce qui ne s'imprime pas, les articles 9 et 11 |
| `test-devis-pdf-decennale-mediateur.ts` | 7 cas — le trajet jusqu'au papier, devis et facture |
| `test-decennale-mediateur-db.ts` | 5 cas — le figé : changer d'assureur ne réécrit pas un devis parti |
| les écrans | regardés, remplis et vidés |

Les trois suites ont été **mises en rouge exprès** avant d'être crues.

## 7. Ce qui reste ouvert

**Le contenu de vos deux champs.** Atlas n'invente ni un nom d'assureur ni un
médiateur : tant que vous ne les saisissez pas, vos devis partent sans ces deux
mentions, et l'écran vous le dit. Le nom du médiateur auquel vous adhérez est la
seule chose que personne d'autre que vous ne peut remplir.
