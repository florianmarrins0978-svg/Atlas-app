# La facture et le devis sont-ils en règle ?

*Vérification du 3 octobre 2026, à sa demande : « corrige à la racine ce
problème, ensuite va vérifier qu'il manque rien sur la facture qui est
obligatoire pour qu'elle soit en règle, et vérifie aussi le devis ! Je veux
aucune erreur ! »*

## En cinq lignes

1. **Corrigé** : le numéro de TVA intracommunautaire, saisi dans Réglages,
   n'apparaissait sur **aucune** facture. Il y est désormais.
2. **La facture a encore quatre trous** : l'adresse du client, la date des
   travaux, la mention « EI » et la forme juridique.
3. **Le devis en a quatre** : la date de début des travaux, le formulaire de
   rétractation, la mention « EI », et des crochets `[...]` imprimés tels quels.
4. **Rien n'empêche aujourd'hui** d'envoyer un document auquel il manque une
   mention. Aucune garde n'existe.
5. **Rien de ce qui reste n'est codé** : chaque point change ce qui s'imprime
   ou ce qui bloque, donc il passe d'abord par une maquette.

## Comment ça a été vérifié, et la limite

| | |
|---|---|
| **Le code** | lu fichier par fichier : tout ce que la facture et le devis impriment, et ce qui bloque leur envoi |
| **L'écran** | l'application lancée ici, le PDF regardé |
| **La loi** | Code général des impôts (art. 242 nonies A, annexe II), Code de commerce, Code de la consommation, Code des assurances |
| **La limite** | les sites officiels (impots.gouv.fr, Légifrance, service-public) sont **bloqués depuis l'environnement de l'assistant**. Les textes ont été lus par des extraits de moteur de recherche et des cabinets comptables qui les citent. **Pour une certitude à 100 %, faire relire une facture et un devis d'essai par le comptable.** |

## 1. Ce qui est corrigé

**Le numéro de TVA intracommunautaire sur la facture.** Obligatoire sur toute
facture d'un assujetti (art. 242 nonies A, I-4°).

| | |
|---|---|
| **La racine** | `identiteDeLEmetteur` (`src/server/repositories/factures.ts`) recopiait le SIRET, l'IBAN et le régime de TVA sur la facture, mais pas le numéro |
| **La correction** | migration 0117 (`factures.entreprise_numero_tva`). Le numéro est recopié avec le reste de l'identité, et s'imprime sous le SIRET : « TVA intracommunautaire FR… » |
| **Les brouillons déjà ouverts** | une facture reprend l'émetteur **du jour où elle part**, comme elle reprenait déjà la date. Un brouillon ouvert avant la correction partira donc avec le numéro. L'aperçu du brouillon montre ce qui partira |
| **Les factures déjà parties** | elles restent sans le numéro : une facture émise ne se modifie pas. **À voir avec le comptable** s'il faut en corriger certaines |
| **La preuve** | `scripts/test-numero-tva-sur-la-facture-db.ts` : **4 contrôles, vus ROUGES sur l'ancien code, VERTS après**. 24 suites voisines (factures, avoirs, PDF, contrats) rejouées au vert |
| **Le devis** | non touché : la loi n'impose pas le numéro de TVA sur un devis |

## 2. La facture : ce qui manque encore

| Mention | Obligatoire ? | Aujourd'hui dans Atlas | Gravité |
|---|---|---|---|
| **Adresse du client** | oui, toujours (art. 242 nonies A, I-2°) | si elle est vide, Atlas imprime l'adresse du chantier. Si les deux sont vides, **la facture part sans adresse** | haute |
| **Date des travaux**, quand elle diffère de la date de la facture | oui (art. 242 nonies A) | **jamais imprimée**. La facture porte seulement sa propre date, et elle part souvent après le chantier | haute |
| **« EI » ou « entrepreneur individuel »** à côté du nom, pour une entreprise individuelle ou une micro-entreprise | oui depuis 2022 (art. R526-27 du Code de commerce), amende jusqu'à 750 € | **jamais imprimée** | haute pour une EI |
| **Forme juridique, capital, RCS**, pour une société | oui (Code de commerce) | le réglage « Mentions légales » vaut **« aucune » par défaut** : une SARL qui ne le change pas facture sans ces mentions | haute pour une société |
| **Numéro de TVA** pour un assujetti | oui | corrigé (§1), mais **rien n'empêche d'émettre si le numéro n'est pas saisi** | moyenne |
| **Assurance décennale**, pour les travaux qui y sont soumis | oui, sur devis et facture (Code des assurances, art. L243-2) | imprimée si elle est saisie. **Rien ne prévient si elle ne l'est pas** | moyenne |
| **Autoliquidation** | quand la facture est en sous-traitance | pas encore codée (planche `appli/tva-entreprise-et-mairie.html`). Il lui faudra aussi **le numéro de TVA du donneur d'ordre** | à coder avec le bouton |
| Numéro, date, lignes, taux, totaux HT et TVA par taux, TTC, échéance, pénalités, 40 €, escompte, 293 B | oui | **présents** | conforme |
| SIREN du client, nature de l'opération, adresse de livraison | oui avec la facture électronique : **au plus tard le 1er septembre 2027** pour une petite entreprise (date exacte à confirmer) | absents | à prévoir |

**Pas obligatoire, et c'est délibéré :** le numéro RM. Le répertoire des
métiers a fusionné dans le registre national des entreprises (RNE) le
1er janvier 2023, et le SIREN suffit. *À confirmer avec le comptable : des
sources disent encore « RCS ou RM ».*

## 3. Le devis : ce qui manque encore

| Mention | Obligatoire ? | Aujourd'hui dans Atlas | Gravité |
|---|---|---|---|
| **Date de début, ou délai d'exécution des travaux** | oui pour un particulier (Code de la consommation, art. L111-1) | **jamais imprimée**. Les dates proposées au client ne sont pas sur le PDF, et l'article 4 des conditions parle d'un « délai indiqué sur le devis » qui n'y est pas | haute |
| **Formulaire de rétractation**, quand le devis est signé chez le client | oui (art. L221-5 et annexe de l'art. R221-1) | **jamais joint**. L'article 10 des conditions dit le délai de 14 jours, mais pas le formulaire. **Sans le formulaire, le délai de rétractation risque d'être prolongé de 12 mois** (art. L221-20) | **très haute** |
| **« EI » à côté du nom** | oui, sur tous les documents | jamais imprimée | haute pour une EI |
| **Assurance décennale et médiateur** | oui pour un particulier | si l'assureur ou le médiateur n'est pas saisi, le devis imprime **les crochets tels quels** : « [assureur, n° de contrat, couverture géographique] », « [nom et coordonnées] » | haute (le client les voit) |
| **Mention 293 B** pour un compte en franchise | fortement recommandée : le client doit savoir que le prix n'a pas de TVA | jamais imprimée sur le devis, seule la colonne affiche 0 % | moyenne |
| **Durée de validité** | non imposée par la loi, mais attendue | 30 jours par défaut. Si elle est retirée, le pied dit encore « valable selon la durée indiquée ci-dessus » alors qu'aucune durée n'est imprimée | basse |
| **Frais de déplacement** | seulement s'il en facture | aucun champ | basse |
| Nom, adresse, SIRET, lignes, quantités, prix HT, taux, TTC, signature « Bon pour accord », acompte | oui | **présents** | conforme |

## 4. Ce qui n'existe nulle part

**Aucune garde.** Ni le devis ni la facture ne vérifient, avant de partir,
qu'une mention obligatoire est présente. Les seuls refus portent sur les
lignes (devis vide, ligne sans prix). C'est la racine commune de la plupart
des trous ci-dessus : une saisie oubliée dans Réglages devient un document
non conforme, sans un mot.

## 5. Ce que je propose, dans l'ordre

| | Quoi | Pourquoi d'abord |
|---|---|---|
| 1 | **Le formulaire de rétractation** joint au devis d'un particulier | le risque le plus cher : 12 mois de rétractation possible |
| 2 | **Une seule vérification avant l'envoi** du devis et de la facture, qui dit ce qui manque (adresse du client, numéro de TVA, décennale, médiateur, mention EI) et renvoie là où le saisir | elle ferme d'un coup la plupart des trous, et c'est la racine commune |
| 3 | **La date des travaux** sur la facture, **la date de début** sur le devis | deux mentions obligatoires absentes |
| 4 | **« EI »** à côté du nom, et la **forme juridique** imprimée d'office pour une société | aujourd'hui, il faut deviner le bon réglage |
| 5 | Le bouton **« Sous-traitance, sans TVA »**, avec le numéro de TVA du donneur d'ordre | déjà en maquette |

Chacun se dessine d'abord en maquette (`CLAUDE.md` §3 bis) : ce sont des
changements de ce qui s'imprime ou de ce qui bloque.

## Ce qui reste ouvert, et qui tranche

| | Qui |
|---|---|
| L'ordre ci-dessus, et le feu vert pour les maquettes | le patron |
| Les factures déjà parties sans numéro de TVA : faut-il en corriger ? | le comptable |
| Une facture et un devis d'essai relus avant la première vraie | le comptable |
| La batterie complète avant de livrer la correction du §1 sur `main` (niveau 3 : base de données et argent) | le patron, pour l'accord de la lancer |
