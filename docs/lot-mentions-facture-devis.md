# La facture et le devis en règle

*Lot du 3 octobre 2026, à sa demande : « corrige à la racine ce problème,
ensuite va vérifier qu'il manque rien sur la facture qui est obligatoire pour
qu'elle soit en règle, et vérifie aussi le devis ! Je veux aucune erreur ! »
Puis ses choix sur la planche `appli/documents-en-regle-a-choisir.html` :
1A (bloquer), 2A, 3A, 4A, 5B « avec la possibilité de modifier », 6A.*

## En cinq lignes

1. **Tout est codé**, sur la branche, pas encore sur `main`. Rien n'est livré
   chez lui avant la batterie, qui attend son accord.
2. **Un devis ou une facture à qui il manque une mention obligatoire ne part
   plus.** L'écran liste ce qui manque, chaque ligne avec « Compléter ».
3. **La facture** porte le numéro de TVA, la date des travaux, « EI », et le
   bouton « Sous-traitance, sans TVA » avec le numéro du donneur d'ordre.
4. **Le devis** porte le début des travaux, la durée, le formulaire de
   rétractation, « EI », la mention 293 B en franchise ; la date dans les
   14 jours n'est plus acceptée sans la demande expresse du client.
5. **Ouvert** : la relecture d'une facture et d'un devis d'essai par le
   comptable, et trois points listés à la fin.

## Comment ça a été vérifié, et la limite

| | |
|---|---|
| **Le code** | chaque mention suivie de la saisie jusqu'au PDF |
| **Les contrôles** | 19 règles pures (`scripts/test-documents-en-regle.ts`), 9 en base (`scripts/test-documents-en-regle-db.ts`), le refus des 14 jours dans `scripts/test-envois-devis.ts`. Chaque contrôle neuf a été vu ROUGE en cassant la règle qu'il garde |
| **La loi** | Code général des impôts (242 nonies A, 283-2 nonies), Code de commerce (R526-27, R123-237), Code de la consommation (L111-1, L216-1, L221-5, L221-9, L221-18 à 25, R221-1), Code des assurances (L243-2) |
| **La limite** | les sites officiels sont bloqués depuis l'environnement de l'assistant : les textes ont été lus par des sources qui les citent. **Faire relire une facture et un devis d'essai par le comptable** |

## Point par point

| Point | Verdict | Où |
|---|---|---|
| Numéro de TVA de l'artisan sur la facture | **corrigé** : il n'apparaissait sur aucune. Recopié avec l'identité, rafraîchi au jour où la facture part | migration 0117, `factures.ts` (`emetteurDuJour`) |
| **1A** Bloquer s'il manque une mention | **codé**. Devis : nom, adresse, SIRET, forme, capital et RCS d'une société, médiateur, décennale si ses conditions la citent encore entre crochets, nom du client. Facture : les mêmes sauf médiateur et décennale, plus le numéro de TVA (sauf franchise), l'adresse du client ou du chantier, et le numéro du donneur d'ordre en sous-traitance | `src/lib/mentions-manquantes.ts`, `ListeDesManques.tsx`, refus dans les actions d'envoi et d'émission |
| **2A** Début des travaux | **codé** : « sous 30 jours après l'accord » sur le devis et son écran, plus la durée estimée quand elle est connue | `src/lib/retractation.ts`, `devis-pdf.ts` |
| Formulaire de rétractation | **codé** : une page de plus en fin de devis, texte du modèle officiel, coordonnées remplies | `paragraphesFormulaire`, `devis-pdf.ts` |
| **3A** Date dans les 14 jours | **codé** : sans la case cochée, le serveur refuse et la page dit pourquoi | `enregistrerReponse` (`envois-devis.ts`) |
| **4A** « EI » collé au nom, forme d'une société sous le nom | **codé**, sur le PDF, la page du client, les messages. « Ne pas les imprimer » a disparu des Réglages | `nomAvecForme`, `positionEffective` |
| **5B** Sous-traitance, sans TVA | **codé** : l'interrupteur dans un cadre doré, le champ du numéro du donneur d'ordre, retenu sur sa fiche et modifiable. Sur le PDF : aucune ligne de TVA, « Total à payer », la mention d'autoliquidation, le numéro sous le nom du client | `src/lib/autoliquidation.ts`, `FactureClient.tsx`, `facture-pdf.ts` |
| **6A** Date des travaux | **codée** : remplie d'après le planning (dernier jour posé), modifiable tant que la facture n'est pas partie, imprimée « Travaux réalisés » | `dateDesTravauxProposee`, migration 0118 |
| Cadre doré sur « Facture acquittée » | **fait** | `ReglementsRecus.tsx` |
| Mention 293 B sur le devis en franchise | **codée** | `src/lib/franchise-tva.ts` |

## Ce qui a été fait autrement que prévu, et pourquoi

| | |
|---|---|
| **La sous-traitance réécrit les taux en base** | plutôt qu'un drapeau relu partout. L'écran, le PDF, la page du client, les paiements, les avoirs et le relevé lisent tous les taux des lignes : à 0 %, aucun ne peut réclamer la TVA par oubli. Les taux d'avant sont gardés, et l'enlever les rend (une ligne à 10 % redevient à 10 %) |
| **L'adresse du client se relit au départ** | une facture née sans adresse restait figée vide, et le refus ne se serait jamais levé après qu'il l'a complétée sur la fiche. Seul ce qui est VIDE se complète, et seulement sur un brouillon |
| **La date des travaux n'a pas de cadre doré** | il en a demandé deux, sous-traitance et acquittée. Le cadre de la planche servait à montrer ce qui changeait |
| **Le formulaire part sur tous les devis** | Atlas ne distingue pas un particulier d'une entreprise : une page de plus ne coûte rien, un formulaire absent peut coûter 12 mois de rétractation |
| **Sans pose au planning**, la date des travaux proposée est le jour où il crée la facture | c'est le seul fait connu, et il la change d'un geste |

## Ce qui était faux dans ce que j'ai dit, et se corrige ici

| Ce qui a été dit | Ce qui est vrai |
|---|---|
| « La demande expresse du client n'existe pas » | **elle existait** (la case sur la page du client), mais elle ne bloquait rien : un client pouvait accepter une date dans ses 14 jours sans la cocher |
| Le délai de 14 jours, tel qu'Atlas le comptait | **un jour trop court** : accepté le 3, une date au 17 passait sans la case. Corrigé, vu rouge puis vert (`scripts/test-retractation.ts`) |

## Ce qui a été refusé, et ce qu'il aurait coûté

| | |
|---|---|
| Bloquer dans le dépôt plutôt qu'aux portes | 43 suites base et 39 suites navigateur créent des entreprises minimales : toutes auraient rougi sur un refus juste. Le refus vit aux portes du patron (envoyer, émettre), là où il agit |
| Exiger l'adresse du client sur le devis | aucun texte sûr ne l'impose, et un devis dicté sur place sans adresse se serait bloqué |

## Ce qui a changé dans les contrôles

| | |
|---|---|
| 8 suites base | leur client coche désormais la demande expresse quand la date tombe dans les 14 jours, comme il le ferait |
| `test-preparation-envoi.ts` | son entreprise d'essai est mise en règle (`scripts/_entreprise-en-regle.ts`) |
| 6 suites navigateur de la facture | leur chantier a une adresse, mention obligatoire |
| Le jeu de démonstration | une identité complète : forme EI, numéro de TVA, médiateur, décennale |

## Le 4 octobre : Mr, Mme ou Entreprise, et le devis en sous-traitance

| Point | Verdict | Où |
|---|---|---|
| « Mr. Jardins Ribault » sur les devis et factures d'une entreprise | **corrigé** : la fiche a trois pastilles, Mr, Mme, **Entreprise** ; Entreprise écrit le nom seul | `src/lib/civilite.ts`, `ChoixCivilite.tsx`, migration 0119 |
| Ce qu'il faut remplir pour une entreprise | **codé** : en touchant Entreprise, le SIRET et le numéro de TVA apparaissent ; ils s'impriment sous son nom, sur le devis et la facture | `SesCoordonnees.tsx`, `document-commun.ts` |
| Ses entreprises à part | **codé** : « Vos clients » montre les particuliers, la porte « Vos entreprises › » ouvre la même liste, rangée et cherchable | `src/app/clients/page.tsx` |
| Le devis en sous-traitance, **B : décoché d'office** | **codé** pour un client Entreprise : prix HT, mention d'autoliquidation, ni TVA ni formulaire de rétractation ; la page du client ne demande plus la case des 14 jours ; la facture qui en naît est déjà sans TVA, et ne se rallume pas | `majAutoliquidationDevis` (`devis.ts`), `DevisCompletClient.tsx` |
| SIRET et n° TVA **à la création d'un chantier** | **codé** : « Entreprise » les fait apparaître, sur une rangée ; ils complètent sa fiche. Pas en reprise d'un chantier existant : là, ils se corrigent sur sa fiche | `FormulaireNouveauChantier.tsx`, `completerLaFiche` |
| Le bouton de la facture | **retiré quand la facture vient d'un devis** : elle suit le devis, coché ou non (sa remarque). Gardé sur une facture faite sans devis, pour une entreprise | `FactureClient.tsx`, `majAutoliquidationFacture` |

**Ce qui a été fait autrement que la planche, et pourquoi :** la pastille
choisie garde la couleur des deux autres pastilles de l'application (fond
clair, contour doré), pas le vert de la planche ; c'est le composant existant
qui fait foi.

**Ce qui a été corrigé en route :** un contrôle de ce lot ne regardait que
l'absence de « Mr. » ; en cassant volontairement la règle, le papier écrivait
« undefined Jardins Ribault » et le contrôle restait vert. Il exige maintenant
le nom seul sur sa ligne, et rougit sur la casse.

## Ce qui reste ouvert

| | Qui |
|---|---|
| La batterie complète (niveau 3 : base de données et argent), avant `main` | **le patron**, pour l'accord de la lancer |
| Une facture et un devis d'essai relus, dont une facture en sous-traitance | le comptable |
| Les factures déjà parties sans numéro de TVA : faut-il en corriger ? | le comptable |
| Le relevé de TVA montre une facture en sous-traitance « À 0 % ». Faut-il la nommer « autoliquidation » (ligne 05 de la déclaration) ? | le patron, sur planche |
| Les factures de contrat d'entretien, émises seules, ne passent pas par la vérification des mentions | à décider : elles partent sans geste du patron, donc sans écran où lister ce qui manque |
| La facture électronique (SIREN du client, nature de l'opération) | au plus tard en 2027, à prévoir |
